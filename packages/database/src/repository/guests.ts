import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { guestReportText, guestSectionPath, matchGuestFact, nextGuestProposal } from '../guest-signal'
import { facts, guestAudits, guestSubmissions, places, users, venues, verificationQueue } from '../tables'
import { Facts } from './facts'

export type GuestWriteReason = 'pending' | 'duplicate' | 'cap'

export interface GuestCreateInput {
  userId: string
  subjectType: 'place' | 'venue'
  subjectId: string
  kind: 'review' | 'tip' | 'photo' | 'correction'
  body: string | null
  alt: string | null
  correctionKind: 'hours' | 'phone' | 'address' | 'status' | 'price' | 'other' | null
  correctionValue: string | null
  sourceUrl: string | null
  mediaId: string | null
  bodyKey: string | null
}

function uniqueReason(error: unknown): GuestWriteReason | null {
  const wrapped = error as { code?: string, constraint?: string, cause?: { code?: string, constraint?: string } }
  const code = wrapped.code ?? wrapped.cause?.code
  if (code !== '23505') {
    return null
  }
  const name = wrapped.constraint ?? wrapped.cause?.constraint ?? ''
  if (name.includes('body')) {
    return 'duplicate'
  }
  if (name.includes('pending')) {
    return 'pending'
  }
  return 'cap'
}

export class Guests {
  static async audit(submissionId: string, actorUserId: string | null, action: string) {
    await useDatabase().insert(guestAudits).values({ submissionId, actorUserId, action })
  }

  static async create(input: GuestCreateInput): Promise<{ ok: true, id: string } | { ok: false, reason: GuestWriteReason }> {
    const db = useDatabase()
    const sameSubject = and(
      eq(guestSubmissions.userId, input.userId),
      eq(guestSubmissions.subjectType, input.subjectType),
      eq(guestSubmissions.subjectId, input.subjectId),
      eq(guestSubmissions.kind, input.kind),
    )
    const [pending] = await db.select({ id: guestSubmissions.id }).from(guestSubmissions).where(and(sameSubject, eq(guestSubmissions.status, 'pending'))).limit(1)
    if (pending) {
      return { ok: false, reason: 'pending' }
    }
    if (input.kind === 'review' || input.kind === 'tip') {
      const [accepted] = await db.select({ id: guestSubmissions.id }).from(guestSubmissions).where(and(sameSubject, eq(guestSubmissions.status, 'accepted'))).limit(1)
      if (accepted) {
        return { ok: false, reason: 'cap' }
      }
    }
    if (input.kind === 'photo') {
      const rows = await db.select({ id: guestSubmissions.id }).from(guestSubmissions).where(and(sameSubject, eq(guestSubmissions.status, 'accepted')))
      if (rows.length >= 3) {
        return { ok: false, reason: 'cap' }
      }
    }
    if (input.bodyKey) {
      const [dup] = await db.select({ id: guestSubmissions.id }).from(guestSubmissions).where(and(
        eq(guestSubmissions.subjectType, input.subjectType),
        eq(guestSubmissions.subjectId, input.subjectId),
        eq(guestSubmissions.kind, input.kind),
        eq(guestSubmissions.bodyKey, input.bodyKey),
        inArray(guestSubmissions.status, ['pending', 'accepted']),
      )).limit(1)
      if (dup) {
        return { ok: false, reason: 'duplicate' }
      }
    }
    try {
      const [row] = await db.insert(guestSubmissions).values({
        userId: input.userId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        kind: input.kind,
        body: input.body,
        alt: input.alt,
        correctionKind: input.correctionKind,
        correctionValue: input.correctionValue,
        sourceUrl: input.sourceUrl,
        mediaId: input.mediaId,
        bodyKey: input.bodyKey,
      }).returning({ id: guestSubmissions.id })
      if (!row) {
        throw new Error('Guest insert failed')
      }
      await Guests.audit(row.id, input.userId, 'submit')
      return { ok: true, id: row.id }
    } catch (error) {
      const reason = uniqueReason(error)
      if (reason) {
        return { ok: false, reason }
      }
      throw error
    }
  }

  static async byId(id: string) {
    const [row] = await useDatabase().select().from(guestSubmissions).where(eq(guestSubmissions.id, id)).limit(1)
    return row ?? null
  }

  static async decide(id: string, actorUserId: string, status: 'accepted' | 'rejected', note: string | null) {
    const now = new Date().toISOString()
    const [row] = await useDatabase().update(guestSubmissions).set({
      status,
      decidedBy: actorUserId,
      decidedAt: now,
      decisionNote: note,
      updatedAt: now,
      disputed: false,
    }).where(and(eq(guestSubmissions.id, id), eq(guestSubmissions.status, 'pending'))).returning()
    if (row) {
      await Guests.audit(row.id, actorUserId, status === 'accepted' ? 'accept' : 'reject')
    }
    return row ?? null
  }

  static async flagDispute(id: string, actorUserId: string) {
    const now = new Date().toISOString()
    const [row] = await useDatabase().update(guestSubmissions).set({
      disputed: true,
      updatedAt: now,
    }).where(and(eq(guestSubmissions.id, id), eq(guestSubmissions.status, 'pending'))).returning()
    if (row) {
      await Guests.audit(row.id, actorUserId, 'dispute')
    }
    return row ?? null
  }

  static async clearRow(id: string, actorUserId: string | null, action: string) {
    const current = await Guests.byId(id)
    if (!current || current.status === 'removed') {
      return null
    }
    const mediaId = current.mediaId
    const now = new Date().toISOString()
    await useDatabase().update(guestSubmissions).set({
      status: 'removed',
      body: null,
      alt: null,
      correctionValue: null,
      sourceUrl: null,
      decisionNote: null,
      bodyKey: null,
      mediaId: null,
      updatedAt: now,
    }).where(eq(guestSubmissions.id, id))
    await Guests.audit(id, actorUserId, action)
    return { mediaId }
  }

  static async removeOwn(id: string, userId: string) {
    const current = await Guests.byId(id)
    if (!current || current.userId !== userId || current.status === 'removed') {
      return null
    }
    return Guests.clearRow(id, userId, 'remove')
  }

  static async clearUser(userId: string) {
    const rows = await useDatabase().select({ id: guestSubmissions.id, mediaId: guestSubmissions.mediaId }).from(guestSubmissions).where(and(
      eq(guestSubmissions.userId, userId),
      ne(guestSubmissions.status, 'removed'),
    ))
    const mediaIds = rows.flatMap((row) => row.mediaId ? [row.mediaId] : [])
    const now = new Date().toISOString()
    if (rows.length) {
      await useDatabase().update(guestSubmissions).set({
        status: 'removed',
        body: null,
        alt: null,
        correctionValue: null,
        sourceUrl: null,
        decisionNote: null,
        bodyKey: null,
        mediaId: null,
        updatedAt: now,
      }).where(inArray(guestSubmissions.id, rows.map((row) => row.id)))
      for (const row of rows) {
        await Guests.audit(row.id, userId, 'clear')
      }
    }
    return mediaIds
  }

  static async published(subjectType: 'place' | 'venue', subjectId: string) {
    const rows = await useDatabase().execute(sql`
      select g.id, g.kind, g.body, g.alt, g.decided_at, g.media_id, u.name as user_name,
        m.filename, m.alt as media_alt, m.caption, m.author, m.credit, m.license, m.source_url,
        m.width, m.height, m.focal_x, m.focal_y, m.dominant_color, m.lqip, m.variants
      from (
        select id, kind, body, alt, decided_at, media_id, user_id,
          row_number() over (partition by kind order by decided_at desc) as n
        from guest_submissions
        where subject_type = ${subjectType}
          and subject_id = ${subjectId}
          and status = 'accepted'
          and kind in ('review', 'tip', 'photo')
      ) g
      join users u on u.id = g.user_id
      left join media m on m.id = g.media_id
      where (g.kind = 'review' and g.n <= 30)
         or (g.kind = 'tip' and g.n <= 10)
         or (g.kind = 'photo' and g.n <= 12)
      order by g.decided_at desc
    `)
    return rowsOf<GuestPublishedRow>(rows)
  }

  static async pendingQueue() {
    return useDatabase().select({
      id: guestSubmissions.id,
      createdAt: guestSubmissions.createdAt,
      kind: guestSubmissions.kind,
      body: guestSubmissions.body,
      alt: guestSubmissions.alt,
      correctionKind: guestSubmissions.correctionKind,
      correctionValue: guestSubmissions.correctionValue,
      sourceUrl: guestSubmissions.sourceUrl,
      disputed: guestSubmissions.disputed,
      mediaId: guestSubmissions.mediaId,
      subjectType: guestSubmissions.subjectType,
      subjectId: guestSubmissions.subjectId,
      userName: users.name,
      placeTitle: places.title,
      placeSlug: places.slug,
      venueName: venues.name,
      venueSlug: venues.slug,
    }).from(guestSubmissions).innerJoin(users, eq(users.id, guestSubmissions.userId)).leftJoin(places, and(eq(guestSubmissions.subjectType, 'place'), eq(places.id, guestSubmissions.subjectId))).leftJoin(venues, and(eq(guestSubmissions.subjectType, 'venue'), eq(venues.id, guestSubmissions.subjectId))).where(eq(guestSubmissions.status, 'pending')).orderBy(asc(guestSubmissions.createdAt))
  }

  static async forUser(userId: string) {
    return useDatabase().select({
      id: guestSubmissions.id,
      createdAt: guestSubmissions.createdAt,
      decidedAt: guestSubmissions.decidedAt,
      kind: guestSubmissions.kind,
      status: guestSubmissions.status,
      decisionNote: guestSubmissions.decisionNote,
      subjectType: guestSubmissions.subjectType,
      placeTitle: places.title,
      placeSlug: places.slug,
      venueName: venues.name,
      venueSlug: venues.slug,
    }).from(guestSubmissions).leftJoin(places, and(eq(guestSubmissions.subjectType, 'place'), eq(places.id, guestSubmissions.subjectId))).leftJoin(venues, and(eq(guestSubmissions.subjectType, 'venue'), eq(venues.id, guestSubmissions.subjectId))).where(and(eq(guestSubmissions.userId, userId), ne(guestSubmissions.status, 'removed'))).orderBy(desc(guestSubmissions.createdAt))
  }

  static async openSectionSignals() {
    return useDatabase().select().from(verificationQueue).where(and(
      isNull(verificationQueue.resolvedAt),
      eq(verificationQueue.reason, 'guest_report'),
      eq(verificationQueue.target, 'section'),
    )).orderBy(asc(verificationQueue.enqueuedAt))
  }

  /**
   * Accepting a correction queues a signal. It does not write facts,
   * revisions, schedules, or venue prices.
   */
  static async signalCorrection(input: {
    submissionId: string
    subjectType: 'place' | 'venue'
    subjectId: string
    correctionKind: string
    value: string
    note: string
    url: string | null
    priority: number
  }) {
    const live = input.correctionKind === 'other'
      ? []
      : await useDatabase().select({
          id: facts.id,
          kind: facts.kind,
          slot: facts.slot,
          value: facts.value,
        }).from(facts).where(and(
          eq(facts.subjectType, input.subjectType),
          eq(facts.subjectId, input.subjectId),
          eq(facts.kind, input.correctionKind),
          isNull(facts.retiredAt),
        ))
    const hints = live.map((fact) => ({
      id: fact.id,
      kind: fact.kind,
      slot: fact.slot,
      itemSlug: priceSlug(fact.value),
    }))
    const matched = matchGuestFact(input.correctionKind, input.value, hints)
    const text = guestReportText(input.value, input.note)
    const proposalInput = { submissionId: input.submissionId, text, url: input.url }
    if (matched) {
      const [existing] = await useDatabase().select().from(verificationQueue).where(and(
        eq(verificationQueue.target, 'fact'),
        eq(verificationQueue.factId, matched.id),
        eq(verificationQueue.reason, 'guest_report'),
        isNull(verificationQueue.resolvedAt),
      )).limit(1)
      return Facts.enqueue({
        target: 'fact',
        factId: matched.id,
        pageType: input.subjectType,
        entityId: input.subjectId,
        path: matched.slot,
        reason: 'guest_report',
        priority: input.priority,
        proposal: { ...nextGuestProposal(existing?.proposal, proposalInput) },
      })
    }
    const path = guestSectionPath(input.correctionKind)
    const [existing] = await useDatabase().select().from(verificationQueue).where(and(
      eq(verificationQueue.target, 'section'),
      eq(verificationQueue.pageType, input.subjectType),
      eq(verificationQueue.entityId, input.subjectId),
      eq(verificationQueue.path, path),
      eq(verificationQueue.reason, 'guest_report'),
      isNull(verificationQueue.resolvedAt),
    )).limit(1)
    return Facts.enqueue({
      target: 'section',
      pageType: input.subjectType,
      entityId: input.subjectId,
      path,
      reason: 'guest_report',
      priority: input.priority,
      proposal: { ...nextGuestProposal(existing?.proposal, proposalInput) },
    })
  }
}

function priceSlug(value: unknown) {
  if (!value || typeof value !== 'object' || !('itemSlug' in value)) {
    return null
  }
  const slug = (value as { itemSlug?: unknown }).itemSlug
  return typeof slug === 'string' ? slug : null
}

export interface GuestPublishedRow {
  id: string
  kind: string
  body: string | null
  alt: string | null
  decided_at: string | null
  media_id: string | null
  user_name: string
  filename: string | null
  media_alt: string | null
  caption: string | null
  author: string | null
  credit: string | null
  license: string | null
  source_url: string | null
  width: number | null
  height: number | null
  focal_x: number | null
  focal_y: number | null
  dominant_color: string | null
  lqip: string | null
  variants: unknown
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }
  return (result as { rows?: T[] }).rows ?? []
}
