import type { PageKind, PrimaryAction, SourceLink, StoredPageModule } from '../types/entities'
import type { CatalogArticle, CatalogHub, CatalogPassport, CatalogStop, CatalogVenue, ContentCatalog, PageMetric, PassportWrite, ScorePlace, StoredScore } from '../types/scoring'
import { createId } from '@paralleldrive/cuid2'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { useDatabase } from '../database'
import { categories, collectionItems, collections, contentScoreDays, contentScores, pagePassports, pagePersonas, places, quests, questSteps, regions, relatedLinks, routePoints, routes, schedules, venues } from '../tables'
import { hoursAreSet } from '../venues'

const HUB_SLUGS = ['forty', 'zamki', 'plyazhi', 'kurorty', 'muzei', 'eda']

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }
  return (result as { rows?: T[] }).rows ?? []
}

function num(value: unknown) {
  if (value == null || value === '') {
    return 0
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function dayKey(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  return String(value).slice(0, 10)
}

function statusOf(value: string): CatalogArticle['publicationStatus'] | null {
  if (value === 'draft' || value === 'review' || value === 'published') {
    return value
  }
  return null
}

export class Scoring {
  static async loadCatalog(): Promise<ContentCatalog> {
    const db = useDatabase()
    const placeRows = await db.select({
      id: places.id,
      slug: places.slug,
      title: places.title,
      summary: places.summary,
      body: places.body,
      howToGet: places.howToGet,
      hours: places.hours,
      price: places.price,
      latitude: places.latitude,
      longitude: places.longitude,
      publicationStatus: places.publicationStatus,
      noindex: places.noindex,
      seoTitle: places.seoTitle,
      seoDescription: places.seoDescription,
      lastVerifiedAt: places.lastVerifiedAt,
      sources: places.sources,
      faq: places.faq,
      categorySlug: categories.slug,
      categoryTitle: categories.title,
      regionId: places.regionId,
      regionTitle: regions.title,
      updatedAt: places.updatedAt,
      scheduleMode: sql<string | null>`${schedules.rules}->>'mode'`,
    }).from(places).leftJoin(schedules, and(eq(schedules.entityType, 'place'), eq(schedules.entityId, places.id))).leftJoin(categories, eq(places.categoryId, categories.id)).leftJoin(regions, eq(places.regionId, regions.id)).where(ne(places.publicationStatus, 'archived'))

    const routeRows = await db.select().from(routes).where(ne(routes.publicationStatus, 'archived'))
    const collectionRows = await db.select().from(collections).where(ne(collections.publicationStatus, 'archived'))
    const questRows = await db.select({
      quest: quests,
      routeSlug: routes.slug,
    }).from(quests).leftJoin(routes, eq(quests.routeId, routes.id)).where(ne(quests.publicationStatus, 'archived'))

    const routeStopRows = await db.select({
      parentId: routePoints.routeId,
      placeSlug: places.slug,
      placePublished: places.publicationStatus,
    }).from(routePoints).innerJoin(places, eq(routePoints.placeId, places.id))
    const collectionStopRows = await db.select({
      parentId: collectionItems.collectionId,
      placeSlug: places.slug,
      placePublished: places.publicationStatus,
      regionId: places.regionId,
      note: collectionItems.note,
      howToGet: places.howToGet,
    }).from(collectionItems).innerJoin(places, eq(collectionItems.placeId, places.id))
    const questStopRows = await db.select({
      parentId: questSteps.questId,
      placeSlug: places.slug,
      placePublished: places.publicationStatus,
    }).from(questSteps).innerJoin(places, eq(questSteps.placeId, places.id))

    const hubRows = await db.select().from(categories).where(inArray(categories.slug, HUB_SLUGS))
    const fromPlace = alias(places, 'from_place')
    const toPlace = alias(places, 'to_place')
    const relatedRows = await db.select({
      fromSlug: fromPlace.slug,
      toSlug: toPlace.slug,
    }).from(relatedLinks).innerJoin(fromPlace, eq(relatedLinks.fromPlaceId, fromPlace.id)).innerJoin(toPlace, eq(relatedLinks.toPlaceId, toPlace.id))

    const photoResult = await db.execute(sql`
      select place_id, count(*)::int as photos
      from (
        select place_id from place_media
        union all
        select m.place_id from media m
        where m.place_id is not null
          and not exists (select 1 from place_media pm where pm.place_id = m.place_id)
      ) shots
      group by place_id
    `)
    const passports = await db.select().from(pagePassports)
    const venueRows = await db.select({
      venue: venues,
      regionSlug: regions.slug,
      regionTitle: regions.title,
    }).from(venues).leftJoin(regions, eq(venues.regionId, regions.id)).where(sql`${venues.status} in ('draft', 'published')`)
    const venuePhotoResult = await db.execute(sql`
      select venue_id, count(*)::int as photos
      from venue_media
      group by venue_id
    `)

    const article = (row: { id: string, slug: string, title: string, summary: string | null, body: string, publicationStatus: string, noindex: boolean, seoTitle: string | null, seoDescription: string | null, updatedAt: string, modules?: StoredPageModule[], sources?: SourceLink[] }, routeSlug: string | null = null): CatalogArticle | null => {
      const publicationStatus = statusOf(row.publicationStatus)
      if (!publicationStatus) {
        return null
      }
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        summary: row.summary || '',
        body: row.body,
        publicationStatus,
        noindex: row.noindex,
        seoTitle: row.seoTitle,
        seoDescription: row.seoDescription,
        updatedAt: row.updatedAt,
        routeSlug,
        modules: row.modules ?? [],
        sourcesCount: row.sources?.length ?? 0,
      }
    }
    const stops = (rows: Array<{
      parentId: string
      placeSlug: string
      placePublished: string
      regionId?: string | null
      note?: string | null
      howToGet?: string | null
    }>): CatalogStop[] => rows.map((row) => {
      const access = [row.note, row.howToGet].map((item) => item?.trim()).filter((item): item is string => Boolean(item)).join('\n')
      return {
        parentId: row.parentId,
        placeSlug: row.placeSlug,
        placePublished: row.placePublished === 'published',
        regionId: row.regionId ?? null,
        access: access || null,
      }
    })

    return {
      places: placeRows.flatMap((row): ScorePlace[] => {
        const publicationStatus = statusOf(row.publicationStatus)
        if (!publicationStatus) {
          return []
        }
        return [{
          id: row.id,
          slug: row.slug,
          title: row.title,
          summary: row.summary,
          body: row.body,
          howToGet: row.howToGet,
          hours: row.hours,
          price: row.price,
          latitude: row.latitude,
          longitude: row.longitude,
          publicationStatus,
          noindex: row.noindex,
          seoTitle: row.seoTitle,
          seoDescription: row.seoDescription,
          factsCheckedAt: row.lastVerifiedAt,
          sources: row.sources ?? [],
          faq: (row.faq ?? []).flatMap((item) => {
            const question = item.question?.trim()
            const answer = item.answer?.trim()
            return question && answer ? [{ question, answer }] : []
          }),
          faqCount: (row.faq ?? []).filter((item) => item.question?.trim() && item.answer?.trim()).length,
          categorySlug: row.categorySlug,
          categoryTitle: row.categoryTitle,
          regionId: row.regionId,
          regionTitle: row.regionTitle,
          updatedAt: row.updatedAt,
          scheduleMode: row.scheduleMode ?? null,
        }]
      }),
      routes: routeRows.flatMap((row) => {
        const mapped = article(row)
        return mapped ? [mapped] : []
      }),
      routeStops: stops(routeStopRows),
      collections: collectionRows.flatMap((row) => {
        const mapped = article(row)
        return mapped ? [mapped] : []
      }),
      collectionStops: stops(collectionStopRows),
      quests: questRows.flatMap((row) => {
        const mapped = article(row.quest, row.routeSlug)
        return mapped ? [mapped] : []
      }),
      questStops: stops(questStopRows),
      hubs: hubRows.map((row): CatalogHub => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        body: row.body,
        noindex: row.noindex,
        seoTitle: row.seoTitle,
        seoDescription: row.seoDescription,
        updatedAt: row.updatedAt,
      })),
      venues: venueRows.flatMap((row): CatalogVenue[] => {
        const publicationStatus = row.venue.status === 'published' ? 'published' as const : row.venue.status === 'draft' ? 'draft' as const : null
        if (!publicationStatus) {
          return []
        }
        const description = row.venue.description.trim()
        return [{
          id: row.venue.id,
          slug: row.venue.slug,
          name: row.venue.name,
          kind: row.venue.kind,
          description,
          hoursSet: hoursAreSet(row.venue.hours),
          latitude: row.venue.latitude,
          longitude: row.venue.longitude,
          publicationStatus,
          noindex: row.venue.noindex || description.length === 0,
          seoTitle: row.venue.seoTitle,
          seoDescription: row.venue.seoDescription,
          factsCheckedAt: row.venue.lastVerifiedAt,
          regionSlug: row.regionSlug,
          regionTitle: row.regionTitle,
          updatedAt: row.venue.updatedAt,
        }]
      }),
      related: relatedRows,
      photos: rowsOf<{ place_id: string, photos: number }>(photoResult).map((row) => ({
        placeId: row.place_id,
        count: num(row.photos),
      })),
      venuePhotos: rowsOf<{ venue_id: string, photos: number }>(venuePhotoResult).map((row) => ({
        venueId: row.venue_id,
        count: num(row.photos),
      })),
      passports: passports.map((row): CatalogPassport => ({
        id: row.id,
        pageType: row.pageType,
        entityId: row.entityId,
        path: row.path,
        targetQueries: row.targetQueries ?? [],
        audience: row.audience,
        primaryAction: row.primaryAction,
        goal30d: row.goal30d,
        goal90d: row.goal90d,
        notes: row.notes,
        lengthOverride: row.lengthOverride ?? null,
      })),
    }
  }

  static async pageMetrics(now = new Date()): Promise<PageMetric[]> {
    const day = 86_400_000
    const d7 = new Date(now.getTime() - 7 * day).toISOString()
    const d30 = new Date(now.getTime() - 30 * day).toISOString()
    const d90 = new Date(now.getTime() - 90 * day).toISOString()
    const db = useDatabase()
    const hits = await db.execute(sql`
      select path,
        count(*) filter (where event_type = 'pageview' and is_entry and channel like 'organic%' and occurred_at >= ${d7})::int as organic_7d,
        count(*) filter (where event_type = 'pageview' and is_entry and channel like 'organic%' and occurred_at >= ${d30})::int as organic_30d,
        count(*) filter (where event_type = 'pageview' and is_entry and channel like 'organic%' and occurred_at >= ${d90})::int as organic_90d,
        count(*) filter (where event_type = 'pageview' and occurred_at >= ${d30})::int as pageviews_30d,
        count(*) filter (where event_type = 'outbound' and occurred_at >= ${d30})::int as outbound_clicks,
        avg(engaged_ms) filter (where event_type = 'engage' and engaged_ms is not null and occurred_at >= ${d30}) as avg_engaged,
        count(*) filter (where event_type = 'engage' and occurred_at >= ${d30})::int as engage_events,
        max(case scroll_bucket
          when '100' then 100
          when '75' then 75
          when '50' then 50
          when '25' then 25
          when '0' then 0
          else null end) filter (where scroll_bucket is not null and occurred_at >= ${d30}) as scroll_max,
        count(*) filter (where scroll_bucket is not null and occurred_at >= ${d30})::int as scroll_events
      from analytics_hits
      where is_bot = false and occurred_at >= ${d90}
      group by path
    `)
    const next = await db.execute(sql`
      select a.path, count(distinct a.session_key)::int as continuations
      from analytics_hits a
      join analytics_hits b
        on b.session_key = a.session_key
       and b.path <> a.path
       and b.occurred_at > a.occurred_at
       and b.is_bot = false
       and b.event_type = 'pageview'
      where a.is_bot = false
        and a.event_type = 'pageview'
        and a.occurred_at >= ${d30}
      group by a.path
    `)
    const continuations = new Map(rowsOf<{ path: string, continuations: number }>(next).map((row) => [row.path, num(row.continuations)]))
    return rowsOf<Record<string, unknown>>(hits).map((row) => ({
      path: String(row.path),
      organic7d: num(row.organic_7d),
      organic30d: num(row.organic_30d),
      organic90d: num(row.organic_90d),
      pageviews30d: num(row.pageviews_30d),
      outboundClicks: num(row.outbound_clicks),
      continuations: continuations.get(String(row.path)) ?? 0,
      avgEngagedMs: row.avg_engaged == null ? null : num(row.avg_engaged),
      engageEvents: num(row.engage_events),
      scrollMax: row.scroll_max == null ? null : num(row.scroll_max),
      scrollEvents: num(row.scroll_events),
    }))
  }

  static async searchImported() {
    const result = await useDatabase().execute(sql`select exists(select 1 from analytics_search_queries) as ok`)
    return Boolean(rowsOf<{ ok: boolean }>(result)[0]?.ok)
  }

  static async searchQueriesSince(day: string) {
    const result = await useDatabase().execute(sql`
      select page, query,
        sum(impressions)::int as impressions,
        sum(clicks)::int as clicks
      from analytics_search_queries
      where day >= ${day}::date
      group by page, query
    `)
    return rowsOf<{ page: string, query: string, impressions: number, clicks: number }>(result).map((row) => ({
      page: row.page,
      query: row.query,
      impressions: num(row.impressions),
      clicks: num(row.clicks),
    }))
  }

  static async findPassport(pageType: PageKind, entityId: string) {
    const [row] = await useDatabase().select().from(pagePassports).where(and(
      eq(pagePassports.pageType, pageType),
      eq(pagePassports.entityId, entityId),
    )).limit(1)
    return row ?? null
  }

  static async upsertPassport(input: PassportWrite) {
    const db = useDatabase()
    const [existing] = await db.select().from(pagePassports).where(and(
      eq(pagePassports.pageType, input.pageType),
      eq(pagePassports.entityId, input.entityId),
    )).limit(1)
    if (!existing) {
      const [row] = await db.insert(pagePassports).values({
        id: createId(),
        pageType: input.pageType,
        entityId: input.entityId,
        path: input.path,
        targetQueries: input.targetQueries ?? [],
        audience: blank(input.audience),
        primaryAction: input.primaryAction ?? null,
        goal30d: input.goal30d ?? null,
        goal90d: input.goal90d ?? null,
        notes: blank(input.notes),
        lengthOverride: input.lengthOverride ?? null,
      }).returning()
      return row!
    }
    const [row] = await db.update(pagePassports).set({
      path: input.path,
      targetQueries: input.targetQueries === undefined ? existing.targetQueries : input.targetQueries,
      audience: input.audience === undefined ? existing.audience : blank(input.audience),
      primaryAction: input.primaryAction === undefined ? existing.primaryAction : input.primaryAction,
      goal30d: input.goal30d === undefined ? existing.goal30d : input.goal30d,
      goal90d: input.goal90d === undefined ? existing.goal90d : input.goal90d,
      notes: input.notes === undefined ? existing.notes : blank(input.notes),
      lengthOverride: input.lengthOverride === undefined ? existing.lengthOverride : input.lengthOverride,
      updatedAt: sql`now()`,
    }).where(eq(pagePassports.id, existing.id)).returning()
    return row!
  }

  static async listPagePersonas() {
    return useDatabase().select().from(pagePersonas)
  }

  static async pagePersonas(pageType: PageKind, entityId: string) {
    return useDatabase().select().from(pagePersonas).where(and(eq(pagePersonas.pageType, pageType), eq(pagePersonas.entityId, entityId)))
  }

  /** Replaces the persona list of one page. The caller validates codes and the single primary. */
  static async setPagePersonas(pageType: PageKind, entityId: string, rows: Array<{ code: string, weight: number, primary: boolean }>) {
    return useDatabase().transaction(async (tx) => {
      await tx.delete(pagePersonas).where(and(eq(pagePersonas.pageType, pageType), eq(pagePersonas.entityId, entityId)))
      if (!rows.length) {
        return []
      }
      return tx.insert(pagePersonas).values(rows.map((row) => ({
        id: createId(),
        pageType,
        entityId,
        personaCode: row.code,
        weight: row.weight,
        primary: row.primary,
      }))).returning()
    })
  }

  static async syncPassportPaths(pages: Array<{ pageType: PageKind, entityId: string, path: string }>) {
    const db = useDatabase()
    for (const page of pages) {
      await db.update(pagePassports).set({ path: page.path, updatedAt: sql`now()` }).where(and(
        eq(pagePassports.pageType, page.pageType),
        eq(pagePassports.entityId, page.entityId),
        ne(pagePassports.path, page.path),
      ))
    }
  }

  static async deleteStalePassports(pages: Array<{ pageType: PageKind, entityId: string }>) {
    const live = new Set(pages.map((page) => `${page.pageType}:${page.entityId}`))
    const rows = await useDatabase().select({ id: pagePassports.id, pageType: pagePassports.pageType, entityId: pagePassports.entityId }).from(pagePassports)
    const stale = rows.filter((row) => !live.has(`${row.pageType}:${row.entityId}`)).map((row) => row.id)
    if (stale.length) {
      await useDatabase().delete(pagePassports).where(inArray(pagePassports.id, stale))
    }
  }

  static async replaceScores(rows: StoredScore[], computedAt = new Date().toISOString()) {
    const db = useDatabase()
    await db.transaction(async (tx) => {
      await tx.delete(contentScores)
      if (!rows.length) {
        return
      }
      await tx.insert(contentScores).values(rows.map((row) => ({
        id: createId(),
        computedAt,
        pageType: row.pageType,
        entityId: row.entityId,
        path: row.path,
        title: row.title,
        total: row.total,
        quality: row.quality,
        linking: row.linking,
        indexing: row.indexing,
        results: row.results,
        checks: row.checks,
        signals: row.signals,
      })))
    })
  }

  static async upsertDays(day: string, rows: StoredScore[]) {
    if (!rows.length) {
      return
    }
    await useDatabase().insert(contentScoreDays).values(rows.map((row) => ({
      day,
      pageType: row.pageType,
      entityId: row.entityId,
      path: row.path,
      title: row.title,
      total: row.total,
      quality: row.quality,
      linking: row.linking,
      indexing: row.indexing,
      results: row.results,
      organic30d: row.organic30d,
      organic90d: row.organic90d,
      goal30d: row.goal30d,
      goal90d: row.goal90d,
    }))).onConflictDoUpdate({
      target: [contentScoreDays.day, contentScoreDays.pageType, contentScoreDays.entityId],
      set: {
        path: sql`excluded.path`,
        title: sql`excluded.title`,
        total: sql`excluded.total`,
        quality: sql`excluded.quality`,
        linking: sql`excluded.linking`,
        indexing: sql`excluded.indexing`,
        results: sql`excluded.results`,
        organic30d: sql`excluded.organic_30d`,
        organic90d: sql`excluded.organic_90d`,
        goal30d: sql`excluded.goal_30d`,
        goal90d: sql`excluded.goal_90d`,
      },
    })
  }

  static async listScores(): Promise<StoredScore[]> {
    const rows = await useDatabase().select().from(contentScores)
    return rows.map(stored)
  }

  static async scoreByPath(path: string) {
    const [row] = await useDatabase().select().from(contentScores).where(eq(contentScores.path, path)).limit(1)
    return row ? stored(row) : null
  }

  static async latestDayOnOrBefore(day: string) {
    const result = await useDatabase().execute(sql`
      select max(day)::text as day from content_score_days where day <= ${day}::date
    `)
    const value = rowsOf<{ day: string | null }>(result)[0]?.day
    return value ? dayKey(value) : null
  }

  static async scoresForDay(day: string): Promise<StoredScore[]> {
    const rows = await useDatabase().select().from(contentScoreDays).where(eq(contentScoreDays.day, day))
    return rows.map((row) => ({
      pageType: row.pageType,
      entityId: row.entityId,
      path: row.path,
      title: row.title,
      total: row.total,
      quality: row.quality,
      linking: row.linking,
      indexing: row.indexing,
      results: row.results,
      checks: { quality: [], linking: [], indexing: [], results: [] },
      signals: {},
      organic30d: row.organic30d,
      organic90d: row.organic90d,
      goal30d: row.goal30d,
      goal90d: row.goal90d,
    }))
  }
}

function blank(value: string | null | undefined) {
  const text = value?.trim()
  return text || null
}

function stored(row: typeof contentScores.$inferSelect): StoredScore {
  const signals = row.signals ?? {}
  return {
    pageType: row.pageType,
    entityId: row.entityId,
    path: row.path,
    title: row.title,
    total: row.total,
    quality: row.quality,
    linking: row.linking,
    indexing: row.indexing,
    results: row.results,
    checks: row.checks ?? { quality: [], linking: [], indexing: [], results: [] },
    signals,
    organic30d: num(signals.organic30d),
    organic90d: num(signals.organic90d),
    goal30d: signals.goal30d == null ? null : num(signals.goal30d),
    goal90d: signals.goal90d == null ? null : num(signals.goal90d),
  }
}

export type { PageKind, PrimaryAction }
