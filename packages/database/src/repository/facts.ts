import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { analyticsDaily, analyticsSearchQueries, contentImports, factRefs, factRevisions, facts, pageReviews, sourceDocuments, verificationQueue } from '../tables'

type Executor = Pick<ReturnType<typeof useDatabase>, 'insert' | 'select' | 'update' | 'delete'>

export interface FactWrite {
  kind: string
  subjectType: string
  subjectId: string
  slot: string
  value: unknown
  valueHash: string
  sourceUrl: string | null
  sourceTitle: string | null
  sourceKind: string
  checkedAt: string | null
  ttlDays: number
  confidence: string
  actor: string
}

export interface FactRefWrite {
  consumerType: string
  consumerId: string
  path: string
}

export interface QueueWrite {
  target: 'fact' | 'section'
  factId?: string | null
  pageType?: string | null
  entityId?: string | null
  path?: string | null
  reason: string
  priority?: number
  proposal?: Record<string, unknown> | null
}

const OPEN_LOCK = sql`(${verificationQueue.lockedUntil} is null or ${verificationQueue.lockedUntil} <= now())`

export class Facts {
  static async importApplied(id: string) {
    const [row] = await useDatabase().select({ id: contentImports.id }).from(contentImports).where(eq(contentImports.id, id)).limit(1)
    return Boolean(row)
  }

  static async markImport(id: string) {
    await useDatabase().insert(contentImports).values({ id }).onConflictDoNothing()
  }

  static async liveSlot(subjectType: string, subjectId: string, slot: string, db: Executor = useDatabase()) {
    const [row] = await db.select().from(facts).where(and(
      eq(facts.subjectType, subjectType),
      eq(facts.subjectId, subjectId),
      eq(facts.slot, slot),
      isNull(facts.retiredAt),
    )).limit(1)
    return row ?? null
  }

  static async byId(id: string) {
    const [row] = await useDatabase().select().from(facts).where(eq(facts.id, id)).limit(1)
    return row ?? null
  }

  static async latestActor(factId: string) {
    const [row] = await useDatabase().select({ actor: factRevisions.actor }).from(factRevisions).where(eq(factRevisions.factId, factId)).orderBy(desc(factRevisions.recordedAt)).limit(1)
    return row?.actor ?? null
  }

  static async revisions(factId: string, limit = 20) {
    return useDatabase().select().from(factRevisions).where(eq(factRevisions.factId, factId)).orderBy(desc(factRevisions.recordedAt)).limit(limit)
  }

  static async refsFor(factId: string) {
    return useDatabase().select().from(factRefs).where(eq(factRefs.factId, factId))
  }

  static async forUrl(url: string) {
    return useDatabase().select().from(facts).where(and(eq(facts.sourceUrl, url), isNull(facts.retiredAt)))
  }

  static async upsert(input: FactWrite, refs: FactRefWrite[], db: Executor = useDatabase()) {
    const current = await Facts.liveSlot(input.subjectType, input.subjectId, input.slot, db)
    const sameClaim = current
      && current.valueHash === input.valueHash
      && current.sourceUrl === input.sourceUrl
      && current.sourceKind === input.sourceKind
      && current.sourceTitle === input.sourceTitle
      && current.confidence === input.confidence
    if (current && sameClaim) {
      const [row] = await db.update(facts).set({
        checkedAt: input.checkedAt,
        ttlDays: input.ttlDays,
      }).where(eq(facts.id, current.id)).returning()
      await Facts.replaceRefs(current.id, refs, db)
      return { fact: row ?? current, revised: false }
    }
    if (current && current.valueHash === input.valueHash && current.sourceKind === input.sourceKind && current.sourceUrl === input.sourceUrl && current.confidence === input.confidence) {
      const [row] = await db.update(facts).set({
        checkedAt: input.checkedAt,
        ttlDays: input.ttlDays,
        sourceTitle: input.sourceTitle,
      }).where(eq(facts.id, current.id)).returning()
      if (current.sourceTitle !== input.sourceTitle) {
        await db.insert(factRevisions).values(revisionOf(row ?? current, input.actor))
      }
      await Facts.replaceRefs(current.id, refs, db)
      return { fact: row ?? current, revised: current.sourceTitle !== input.sourceTitle }
    }
    const now = new Date().toISOString()
    if (!current) {
      const [created] = await db.insert(facts).values({
        kind: input.kind,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        slot: input.slot,
        value: input.value,
        valueHash: input.valueHash,
        sourceUrl: input.sourceUrl,
        sourceTitle: input.sourceTitle,
        sourceKind: input.sourceKind,
        checkedAt: input.checkedAt,
        ttlDays: input.ttlDays,
        confidence: input.confidence,
        updatedAt: now,
      }).returning()
      if (!created) {
        throw new Error('Fact insert failed')
      }
      await db.insert(factRevisions).values(revisionOf(created, input.actor))
      await Facts.replaceRefs(created.id, refs, db)
      return { fact: created, revised: true }
    }
    const [row] = await db.update(facts).set({
      kind: input.kind,
      value: input.value,
      valueHash: input.valueHash,
      sourceUrl: input.sourceUrl,
      sourceTitle: input.sourceTitle,
      sourceKind: input.sourceKind,
      checkedAt: input.checkedAt,
      ttlDays: input.ttlDays,
      confidence: input.confidence,
      updatedAt: now,
    }).where(eq(facts.id, current.id)).returning()
    const fact = row ?? current
    await db.insert(factRevisions).values(revisionOf(fact, input.actor))
    await Facts.replaceRefs(fact.id, refs, db)
    return { fact, revised: true }
  }

  static async replaceRefs(factId: string, refs: FactRefWrite[], db: Executor = useDatabase()) {
    await db.delete(factRefs).where(eq(factRefs.factId, factId))
    if (refs.length) {
      await db.insert(factRefs).values(refs.map((ref) => ({ factId, ...ref })))
    }
  }

  static async confirm(id: string, valueHash: string, checkedAt: string) {
    const current = await Facts.byId(id)
    if (!current || current.retiredAt) {
      return { ok: false as const, reason: 'missing' as const }
    }
    if (current.valueHash !== valueHash) {
      return { ok: false as const, reason: 'mismatch' as const, fact: current }
    }
    const [row] = await useDatabase().update(facts).set({ checkedAt }).where(eq(facts.id, id)).returning()
    await Facts.closeForFact(id)
    return { ok: true as const, fact: row ?? current }
  }

  static async retire(id: string) {
    const now = new Date().toISOString()
    await useDatabase().update(facts).set({ retiredAt: now, updatedAt: now }).where(and(eq(facts.id, id), isNull(facts.retiredAt)))
    await useDatabase().delete(factRefs).where(eq(factRefs.factId, id))
    await Facts.closeForFact(id)
  }

  static async retireSlot(subjectType: string, subjectId: string, slot: string) {
    const current = await Facts.liveSlot(subjectType, subjectId, slot)
    if (current) {
      await Facts.retire(current.id)
    }
  }

  static async closeForFact(factId: string, db: Executor = useDatabase()) {
    await db.update(verificationQueue).set({ resolvedAt: new Date().toISOString() }).where(and(eq(verificationQueue.factId, factId), isNull(verificationQueue.resolvedAt)))
  }

  static async close(id: string) {
    await useDatabase().update(verificationQueue).set({ resolvedAt: new Date().toISOString() }).where(and(eq(verificationQueue.id, id), isNull(verificationQueue.resolvedAt)))
  }

  static async enqueue(input: QueueWrite) {
    const db = useDatabase()
    const match = input.target === 'fact'
      ? and(eq(verificationQueue.target, 'fact'), eq(verificationQueue.factId, input.factId ?? ''), eq(verificationQueue.reason, input.reason), isNull(verificationQueue.resolvedAt))
      : and(
          eq(verificationQueue.target, 'section'),
          eq(verificationQueue.pageType, input.pageType ?? ''),
          eq(verificationQueue.entityId, input.entityId ?? ''),
          eq(verificationQueue.path, input.path ?? ''),
          eq(verificationQueue.reason, input.reason),
          isNull(verificationQueue.resolvedAt),
        )
    const [existing] = await db.select().from(verificationQueue).where(match).limit(1)
    if (existing) {
      const [row] = await db.update(verificationQueue).set({
        priority: input.priority ?? existing.priority,
        proposal: input.proposal === undefined ? existing.proposal : input.proposal,
        pageType: input.pageType ?? existing.pageType,
        entityId: input.entityId ?? existing.entityId,
        path: input.path ?? existing.path,
      }).where(eq(verificationQueue.id, existing.id)).returning()
      return row ?? existing
    }
    const [created] = await db.insert(verificationQueue).values({
      target: input.target,
      factId: input.factId ?? null,
      pageType: input.pageType ?? null,
      entityId: input.entityId ?? null,
      path: input.path ?? null,
      reason: input.reason,
      priority: input.priority ?? 0,
      proposal: input.proposal ?? null,
    }).returning()
    if (!created) {
      throw new Error('Queue insert failed')
    }
    return created
  }

  static async listQueue(input: { kind?: string, reason?: string, minPriority?: number, limit: number, claim?: boolean, lockedBy?: string }) {
    const db = useDatabase()
    const filters = [isNull(verificationQueue.resolvedAt), OPEN_LOCK]
    if (input.reason) {
      filters.push(eq(verificationQueue.reason, input.reason))
    }
    if (input.minPriority != null) {
      filters.push(sql`${verificationQueue.priority} >= ${input.minPriority}`)
    }
    if (input.kind) {
      filters.push(sql`exists (select 1 from facts f where f.id = ${verificationQueue.factId} and f.kind = ${input.kind})`)
    }
    const rows = await db.select().from(verificationQueue).where(and(...filters)).orderBy(desc(verificationQueue.priority), asc(verificationQueue.enqueuedAt)).limit(input.limit)
    if (!input.claim || !rows.length) {
      return rows
    }
    const until = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    await db.update(verificationQueue).set({ lockedBy: input.lockedBy ?? 'mcp', lockedUntil: until }).where(inArray(verificationQueue.id, rows.map((row) => row.id)))
    return rows.map((row) => ({ ...row, lockedBy: input.lockedBy ?? 'mcp', lockedUntil: until }))
  }

  static async openConflicts() {
    return useDatabase().select({
      queue: verificationQueue,
      fact: facts,
    }).from(verificationQueue).innerJoin(facts, eq(facts.id, verificationQueue.factId)).where(and(
      isNull(verificationQueue.resolvedAt),
      eq(verificationQueue.reason, 'owner_conflict'),
    )).orderBy(desc(verificationQueue.priority), asc(verificationQueue.enqueuedAt))
  }

  static async queueById(id: string) {
    const [row] = await useDatabase().select().from(verificationQueue).where(eq(verificationQueue.id, id)).limit(1)
    return row ?? null
  }

  static async countsByReason() {
    const rows = await useDatabase().execute(sql`
      select reason, count(*)::int as count
      from verification_queue
      where resolved_at is null
      group by reason
    `)
    return rowsOf<{ reason: string, count: number }>(rows)
  }

  static async topOpen(limit: number) {
    return useDatabase().select({
      id: verificationQueue.id,
      reason: verificationQueue.reason,
      priority: verificationQueue.priority,
      factId: verificationQueue.factId,
      pageType: verificationQueue.pageType,
      entityId: verificationQueue.entityId,
      path: verificationQueue.path,
      kind: facts.kind,
      slot: facts.slot,
      subjectType: facts.subjectType,
      subjectId: facts.subjectId,
    }).from(verificationQueue).leftJoin(facts, eq(facts.id, verificationQueue.factId)).where(isNull(verificationQueue.resolvedAt)).orderBy(desc(verificationQueue.priority), asc(verificationQueue.enqueuedAt)).limit(limit)
  }

  static async freshnessByConsumer(nowIso: string) {
    const rows = await useDatabase().execute(sql`
      select r.consumer_type, r.consumer_id,
        count(*)::int as refs,
        count(*) filter (
          where f.checked_at is null
            or f.checked_at + (f.ttl_days || ' days')::interval <= ${nowIso}::timestamptz
            or exists (
              select 1 from verification_queue q
              where q.fact_id = f.id
                and q.resolved_at is null
                and q.reason in ('source_changed', 'owner_conflict', 'source_gone')
            )
        )::int as stale
      from fact_refs r
      join facts f on f.id = r.fact_id and f.retired_at is null
      group by r.consumer_type, r.consumer_id
    `)
    return rowsOf<{ consumer_type: string, consumer_id: string, refs: number, stale: number }>(rows)
  }

  static async review(pageType: string, entityId: string) {
    const [row] = await useDatabase().select().from(pageReviews).where(and(eq(pageReviews.pageType, pageType), eq(pageReviews.entityId, entityId))).limit(1)
    return row ?? null
  }

  static async saveReview(input: { pageType: string, entityId: string, reviewer: string, sections: Array<{ path: string, hash: string }> }) {
    const now = new Date().toISOString()
    const [row] = await useDatabase().insert(pageReviews).values({
      pageType: input.pageType,
      entityId: input.entityId,
      reviewer: input.reviewer,
      sections: input.sections,
      reviewedAt: now,
    }).onConflictDoUpdate({
      target: [pageReviews.pageType, pageReviews.entityId],
      set: { reviewer: input.reviewer, sections: input.sections, reviewedAt: now },
    }).returning()
    return row
  }

  static async reviews() {
    return useDatabase().select().from(pageReviews)
  }

  static async ensureSource(url: string, nextFetchAt: string) {
    await useDatabase().insert(sourceDocuments).values({ url, nextFetchAt, failCount: 0 }).onConflictDoNothing()
  }

  static async dueSources(limit: number, nowIso: string) {
    const rows = await useDatabase().execute(sql`
      select s.url, s.content_hash, s.etag, s.last_modified, s.fetched_at, s.fail_count,
        coalesce(min(f.ttl_days), 30) as ttl_days,
        bool_or(f.kind in ('hours', 'status')) as urgent
      from source_documents s
      join facts f on f.source_url = s.url and f.retired_at is null
        and f.source_kind in ('official', 'official_social')
      where s.next_fetch_at is null or s.next_fetch_at <= ${nowIso}::timestamptz
      group by s.url, s.content_hash, s.etag, s.last_modified, s.fetched_at, s.fail_count
      order by bool_or(f.kind in ('hours', 'status')) desc,
        coalesce((
          select sum(d.pageviews)
          from analytics_daily d
          where d.day >= (current_date - 30)
            and d.path in (
              select distinct case
                when f2.subject_type = 'place' then '/' || p.slug
                when f2.subject_type = 'venue' then '/zavedeniya/' || v.slug
              end
              from facts f2
              left join places p on f2.subject_type = 'place' and p.id = f2.subject_id
              left join venues v on f2.subject_type = 'venue' and v.id = f2.subject_id
              where f2.source_url = s.url and f2.retired_at is null
            )
        ), 0) desc,
        s.fetched_at asc nulls first
      limit ${limit}
    `)
    return rowsOf<{
      url: string
      content_hash: string | null
      etag: string | null
      last_modified: string | null
      fetched_at: string | null
      fail_count: number
      ttl_days: number
      urgent: boolean
    }>(rows)
  }

  static async recordSource(input: {
    url: string
    contentHash: string | null
    etag: string | null
    lastModified: string | null
    httpStatus: number | null
    fetchedAt: string | null
    nextFetchAt: string | null
    failCount: number
  }) {
    await useDatabase().insert(sourceDocuments).values({
      url: input.url,
      contentHash: input.contentHash,
      etag: input.etag,
      lastModified: input.lastModified,
      httpStatus: input.httpStatus,
      fetchedAt: input.fetchedAt,
      nextFetchAt: input.nextFetchAt,
      failCount: input.failCount,
    }).onConflictDoUpdate({
      target: sourceDocuments.url,
      set: {
        contentHash: input.contentHash,
        etag: input.etag,
        lastModified: input.lastModified,
        httpStatus: input.httpStatus,
        fetchedAt: input.fetchedAt,
        nextFetchAt: input.nextFetchAt,
        failCount: input.failCount,
      },
    })
  }

  /** Move checked_at on facts for this URL that were not edited after the previous fetch. */
  static async renewUrl(url: string, checkedAt: string, previousFetchedAt: string | null) {
    const guard = previousFetchedAt
      ? sql`and f.updated_at <= ${previousFetchedAt}::timestamptz`
      : sql``
    await useDatabase().execute(sql`
      update facts f
      set checked_at = ${checkedAt}::timestamptz
      where f.source_url = ${url}
        and f.retired_at is null
        and f.source_kind in ('official', 'official_social')
        and not exists (
          select 1 from verification_queue q
          where q.fact_id = f.id and q.resolved_at is null and q.reason = 'source_changed'
        )
        ${guard}
    `)
    await useDatabase().execute(sql`
      update verification_queue q
      set resolved_at = ${checkedAt}::timestamptz
      where q.resolved_at is null
        and q.reason in ('ttl_expired', 'fetch_failed')
        and q.fact_id in (
          select f.id from facts f
          where f.source_url = ${url}
            and f.retired_at is null
            and f.checked_at = ${checkedAt}::timestamptz
        )
    `)
  }

  static async setPriorities(rows: Array<{ id: string, priority: number }>) {
    if (!rows.length) {
      return
    }
    const db = useDatabase()
    for (const row of rows) {
      await db.update(verificationQueue).set({ priority: row.priority }).where(eq(verificationQueue.id, row.id))
    }
  }

  static async openRows() {
    return useDatabase().select({
      id: verificationQueue.id,
      target: verificationQueue.target,
      factId: verificationQueue.factId,
      pageType: verificationQueue.pageType,
      entityId: verificationQueue.entityId,
      path: verificationQueue.path,
      reason: verificationQueue.reason,
      kind: facts.kind,
    }).from(verificationQueue).leftJoin(facts, eq(facts.id, verificationQueue.factId)).where(isNull(verificationQueue.resolvedAt))
  }

  static async closeSection(pageType: string, entityId: string, path: string) {
    await useDatabase().update(verificationQueue).set({ resolvedAt: new Date().toISOString() }).where(and(
      eq(verificationQueue.target, 'section'),
      eq(verificationQueue.pageType, pageType),
      eq(verificationQueue.entityId, entityId),
      eq(verificationQueue.path, path),
      eq(verificationQueue.reason, 'section_changed'),
      isNull(verificationQueue.resolvedAt),
    ))
  }

  static async trafficSince(day: string) {
    const views = await useDatabase().select({
      path: analyticsDaily.path,
      pageviews: sql<number>`sum(${analyticsDaily.pageviews})::int`,
    }).from(analyticsDaily).where(sql`${analyticsDaily.day} >= ${day}`).groupBy(analyticsDaily.path)
    const impressions = await useDatabase().select({
      page: analyticsSearchQueries.page,
      impressions: sql<number>`sum(${analyticsSearchQueries.impressions})::int`,
    }).from(analyticsSearchQueries).where(sql`${analyticsSearchQueries.day} >= ${day}`).groupBy(analyticsSearchQueries.page)
    return { views, impressions }
  }

  static async liveFacts() {
    return useDatabase().select().from(facts).where(isNull(facts.retiredAt))
  }

  static async refs() {
    return useDatabase().select().from(factRefs)
  }
}

function revisionOf(fact: typeof facts.$inferSelect, actor: string) {
  return {
    factId: fact.id,
    value: fact.value,
    valueHash: fact.valueHash,
    sourceUrl: fact.sourceUrl,
    sourceTitle: fact.sourceTitle,
    sourceKind: fact.sourceKind,
    checkedAt: fact.checkedAt,
    confidence: fact.confidence,
    actor,
  }
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }
  return (result as { rows?: T[] }).rows ?? []
}
