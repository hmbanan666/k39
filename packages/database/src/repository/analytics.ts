import { createId } from '@paralleldrive/cuid2'
import { sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { analyticsHits, analyticsRuns, analyticsSearchQueries } from '../tables'

export interface AnalyticsHitDraft {
  occurredAt?: string
  visitorKey: string
  visitorMode: string
  sessionKey: string
  consented: boolean
  isBot: boolean
  eventType: string
  path: string
  placeId?: string | null
  routeId?: string | null
  venueId?: string | null
  referrer?: string | null
  referrerHost?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  channel: string
  searchQuery?: string | null
  device?: string | null
  browser?: string | null
  os?: string | null
  screenBucket?: string | null
  language?: string | null
  landingPath?: string | null
  isEntry?: boolean
  isExit?: boolean
  engagedMs?: number | null
  scrollBucket?: string | null
  target?: string | null
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }
  return (result as { rows?: T[] }).rows ?? []
}

interface PathSubject {
  placeId: string | null
  routeId: string | null
  venueId: string | null
}

function emptySubject(): PathSubject {
  return { placeId: null, routeId: null, venueId: null }
}

function textArray(values: string[]) {
  if (!values.length) {
    return sql`array[]::varchar[]`
  }
  return sql`array[${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )}]::varchar[]`
}

function classifyPath(path: string) {
  const clean = path.split('?')[0] || '/'
  const parts = clean.split('/').filter(Boolean)
  if (parts.length === 1 && parts[0]) {
    return { path, kind: 'place' as const, slug: parts[0] }
  }
  if (parts[0] === 'marshruty' && parts[1]) {
    return { path, kind: 'route' as const, slug: parts[1] }
  }
  if (parts[0] === 'zavedeniya' && parts[1] && !parts[2]) {
    return { path, kind: 'venue' as const, slug: parts[1] }
  }
  return { path, kind: 'none' as const, slug: '' }
}

function num(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export class Analytics {
  static async insertHits(hits: AnalyticsHitDraft[]) {
    if (!hits.length) {
      return []
    }
    return useDatabase()
      .insert(analyticsHits)
      .values(
        hits.map((row) => ({
          id: createId(),
          occurredAt: row.occurredAt,
          visitorKey: row.visitorKey,
          visitorMode: row.visitorMode,
          sessionKey: row.sessionKey,
          consented: row.consented,
          isBot: row.isBot,
          eventType: row.eventType,
          path: row.path.slice(0, 500),
          placeId: row.placeId ?? null,
          routeId: row.routeId ?? null,
          venueId: row.venueId ?? null,
          referrer: row.referrer?.slice(0, 500) ?? null,
          referrerHost: row.referrerHost ?? null,
          utmSource: row.utmSource ?? null,
          utmMedium: row.utmMedium ?? null,
          utmCampaign: row.utmCampaign ?? null,
          channel: row.channel,
          searchQuery: row.searchQuery ?? null,
          device: row.device ?? null,
          browser: row.browser ?? null,
          os: row.os ?? null,
          screenBucket: row.screenBucket ?? null,
          language: row.language ?? null,
          landingPath: row.landingPath ?? null,
          isEntry: row.isEntry ?? false,
          isExit: row.isExit ?? false,
          engagedMs: row.engagedMs ?? null,
          scrollBucket: row.scrollBucket ?? null,
          target: row.target?.slice(0, 300) ?? null,
        })),
      )
      .returning({ id: analyticsHits.id })
  }

  static async latestSession(visitorKey: string) {
    const result = await useDatabase().execute(sql`
      select session_key, occurred_at, landing_path, channel
      from analytics_hits
      where visitor_key = ${visitorKey} and is_bot = false and event_type = 'pageview'
      order by occurred_at desc
      limit 1
    `)
    const row = rowsOf<{ session_key: string; occurred_at: string; landing_path: string | null; channel: string }>(
      result,
    )[0]
    return row
      ? {
          sessionKey: row.session_key,
          occurredAt: row.occurred_at,
          landingPath: row.landing_path,
          channel: row.channel,
        }
      : null
  }

  static async markExit(sessionKey: string) {
    await useDatabase().execute(sql`
      update analytics_hits set is_exit = false
      where session_key = ${sessionKey} and event_type = 'pageview' and is_exit = true
    `)
  }

  static async sessionHasPageview(sessionKey: string) {
    const result = await useDatabase().execute(sql`
      select 1 as ok from analytics_hits
      where session_key = ${sessionKey} and event_type = 'pageview'
      limit 1
    `)
    return rowsOf(result).length > 0
  }

  static async resolvePath(path: string) {
    const found = await Analytics.resolvePaths([path])
    return found.get(path) ?? emptySubject()
  }

  /**
   * One query for every path in the batch. Place, route, and venue slugs are
   * looked up together (`= any(...)`), so the query count does not grow with
   * the number of events. Paths that are not a place, route, or venue page
   * are answered from memory.
   */
  static async resolvePaths(paths: string[]) {
    const unique = [...new Set(paths)]
    const found = new Map<string, PathSubject>()
    if (!unique.length) {
      return found
    }
    const placeSlugs = new Set<string>()
    const routeSlugs = new Set<string>()
    const venueSlugs = new Set<string>()
    const parsed = unique.map((path) => {
      const item = classifyPath(path)
      if (item.kind === 'place') {
        placeSlugs.add(item.slug)
      } else if (item.kind === 'route') {
        routeSlugs.add(item.slug)
      } else if (item.kind === 'venue') {
        venueSlugs.add(item.slug)
      }
      return item
    })
    const byPlace = new Map<string, string>()
    const byRoute = new Map<string, string>()
    const byVenue = new Map<string, string>()
    if (placeSlugs.size || routeSlugs.size || venueSlugs.size) {
      const result = await useDatabase().execute(sql`
        select 'place' as kind, id, slug from places where slug = any(${textArray([...placeSlugs])})
        union all
        select 'route' as kind, id, slug from routes where slug = any(${textArray([...routeSlugs])})
        union all
        select 'venue' as kind, id, slug from venues where slug = any(${textArray([...venueSlugs])})
      `)
      for (const row of rowsOf<{ kind: string; id: string; slug: string }>(result)) {
        if (row.kind === 'place') {
          byPlace.set(row.slug, row.id)
        } else if (row.kind === 'route') {
          byRoute.set(row.slug, row.id)
        } else if (row.kind === 'venue') {
          byVenue.set(row.slug, row.id)
        }
      }
    }
    for (const item of parsed) {
      const subject = emptySubject()
      if (item.kind === 'place') {
        subject.placeId = byPlace.get(item.slug) ?? null
      } else if (item.kind === 'route') {
        subject.routeId = byRoute.get(item.slug) ?? null
      } else if (item.kind === 'venue') {
        subject.venueId = byVenue.get(item.slug) ?? null
      }
      found.set(item.path, subject)
    }
    return found
  }

  static async venueStats(venueId: string | null, from: Date, to: Date) {
    const venueClause = venueId ? sql`and venue_id = ${venueId}` : sql`and venue_id is not null`
    const result = await useDatabase().execute(sql`
      select venue_id,
        count(*) filter (where event_type = 'impression')::int as impressions,
        count(*) filter (where event_type = 'pageview')::int as pageviews
      from analytics_hits
      where is_bot = false
        and occurred_at >= ${from.toISOString()}
        and occurred_at < ${to.toISOString()}
        ${venueClause}
      group by venue_id
      order by impressions desc, pageviews desc
    `)
    return rowsOf<{ venue_id: string; impressions: number; pageviews: number }>(result).map((row) => ({
      venueId: row.venue_id,
      impressions: Number(row.impressions) || 0,
      pageviews: Number(row.pageviews) || 0,
    }))
  }

  static async overview(from: Date, to: Date) {
    const result = await useDatabase().execute(sql`
      select
        count(distinct visitor_key) filter (where event_type = 'pageview')::int as visitors,
        count(distinct session_key) filter (where event_type = 'pageview')::int as sessions,
        count(*) filter (where event_type = 'pageview')::int as pageviews,
        coalesce(sum(engaged_ms), 0)::int as engaged_ms
      from analytics_hits
      where occurred_at >= ${from.toISOString()} and occurred_at < ${to.toISOString()} and is_bot = false
    `)
    const bounce = await useDatabase().execute(sql`
      select count(*)::int as bounces from (
        select session_key
        from analytics_hits
        where occurred_at >= ${from.toISOString()} and occurred_at < ${to.toISOString()} and is_bot = false
        group by session_key
        having count(*) filter (where event_type = 'pageview') = 1
          and coalesce(sum(engaged_ms), 0) < 10000
      ) bounced
    `)
    const row = rowsOf<Record<string, unknown>>(result)[0] ?? {}
    const sessions = num(row.sessions)
    const engaged = num(row.engaged_ms)
    const bounces = num(rowsOf<Record<string, unknown>>(bounce)[0]?.bounces)
    return {
      visitors: num(row.visitors),
      sessions,
      pageviews: num(row.pageviews),
      bounceRate: sessions ? Math.round((bounces / sessions) * 1000) / 10 : 0,
      avgEngagedSec: sessions ? Math.round(engaged / sessions / 100) / 10 : 0,
    }
  }

  static async channels(from: Date, to: Date) {
    const result = await useDatabase().execute(sql`
      select channel, count(*)::int as pageviews, count(distinct visitor_key)::int as visitors
      from analytics_hits
      where occurred_at >= ${from.toISOString()} and occurred_at < ${to.toISOString()}
        and is_bot = false and event_type = 'pageview'
      group by channel
      order by pageviews desc
    `)
    return rowsOf<{ channel: string; pageviews: number; visitors: number }>(result)
  }

  static async topPages(from: Date, to: Date, channel?: string) {
    const result = channel
      ? await useDatabase().execute(sql`
        select path, count(*)::int as pageviews, count(distinct visitor_key)::int as visitors
        from analytics_hits
        where occurred_at >= ${from.toISOString()} and occurred_at < ${to.toISOString()}
          and is_bot = false and event_type = 'pageview' and channel = ${channel}
        group by path order by pageviews desc limit 20
      `)
      : await useDatabase().execute(sql`
        select path, count(*)::int as pageviews, count(distinct visitor_key)::int as visitors
        from analytics_hits
        where occurred_at >= ${from.toISOString()} and occurred_at < ${to.toISOString()}
          and is_bot = false and event_type = 'pageview'
        group by path order by pageviews desc limit 20
      `)
    return rowsOf<{ path: string; pageviews: number; visitors: number }>(result)
  }

  static async landingPages(from: Date, to: Date, channel = 'organic:yandex') {
    const result = await useDatabase().execute(sql`
      select landing_path as path, count(*)::int as pageviews
      from analytics_hits
      where occurred_at >= ${from.toISOString()} and occurred_at < ${to.toISOString()}
        and is_bot = false and event_type = 'pageview' and is_entry = true
        and (${channel} = '' or channel = ${channel} or channel like ${`${channel}%`})
      group by landing_path
      order by pageviews desc
      limit 20
    `)
    return rowsOf<{ path: string; pageviews: number }>(result)
  }

  static async referrers(from: Date, to: Date) {
    const result = await useDatabase().execute(sql`
      select referrer_host as host, count(*)::int as pageviews
      from analytics_hits
      where occurred_at >= ${from.toISOString()} and occurred_at < ${to.toISOString()}
        and is_bot = false and event_type = 'pageview' and referrer_host is not null and referrer_host <> ''
        and channel in ('referral', 'organic:yandex', 'organic:google', 'organic:other', 'social:vk', 'social:tg', 'social:other', 'paid')
      group by referrer_host
      order by pageviews desc
      limit 20
    `)
    return rowsOf<{ host: string; pageviews: number }>(result)
  }

  static async searchQueries(from: Date, to: Date, engine?: string, page?: string) {
    const result = await useDatabase().execute(sql`
      select engine, query, page, sum(impressions)::int as impressions, sum(clicks)::int as clicks,
        round(avg(position)::numeric, 1)::float as position
      from analytics_search_queries
      where day >= ${from.toISOString().slice(0, 10)} and day <= ${to.toISOString().slice(0, 10)}
        and (${engine || ''} = '' or engine = ${engine || ''})
        and (${page || ''} = '' or page = ${page || ''} or page like ${`%${page || ''}%`})
      group by engine, query, page
      order by clicks desc, impressions desc
      limit 50
    `)
    return rowsOf<{
      engine: string
      query: string
      page: string
      impressions: number
      clicks: number
      position: number | null
    }>(result)
  }

  static async events(from: Date, to: Date, type?: string) {
    const result = await useDatabase().execute(sql`
      select event_type as type, count(*)::int as count
      from analytics_hits
      where occurred_at >= ${from.toISOString()} and occurred_at < ${to.toISOString()} and is_bot = false
        and (${type || ''} = '' or event_type = ${type || ''})
      group by event_type
      order by count desc
    `)
    return rowsOf<{ type: string; count: number }>(result)
  }

  static async realtime(now = new Date()) {
    const from = new Date(now.getTime() - 30 * 60 * 1000)
    return this.overview(from, now)
  }

  static async pageReport(slug: string, from: Date, to: Date) {
    const path = `/${slug}`
    const totals = await useDatabase().execute(sql`
      select
        count(*) filter (where event_type = 'pageview')::int as pageviews,
        count(distinct visitor_key) filter (where event_type = 'pageview')::int as visitors,
        coalesce(sum(engaged_ms), 0)::int as engaged_ms,
        count(*) filter (where event_type = 'outbound')::int as outbound,
        count(*) filter (where event_type = 'photo')::int as photos
      from analytics_hits
      where occurred_at >= ${from.toISOString()} and occurred_at < ${to.toISOString()} and is_bot = false
        and (path = ${path} or landing_path = ${path} or path like ${`%/${slug}`})
    `)
    const sources = await useDatabase().execute(sql`
      select channel, referrer_host as host, count(*)::int as pageviews
      from analytics_hits
      where occurred_at >= ${from.toISOString()} and occurred_at < ${to.toISOString()} and is_bot = false
        and event_type = 'pageview' and (path = ${path} or path like ${`%/${slug}`})
      group by channel, referrer_host
      order by pageviews desc
      limit 20
    `)
    const queries = await this.searchQueries(from, to, undefined, path)
    const row = rowsOf<Record<string, unknown>>(totals)[0] ?? {}
    return {
      slug,
      pageviews: num(row.pageviews),
      visitors: num(row.visitors),
      engagedMs: num(row.engaged_ms),
      outbound: num(row.outbound),
      photos: num(row.photos),
      sources: rowsOf(sources),
      queries,
    }
  }

  static async purgeRaw(now = new Date()) {
    const cutoff = new Date(now)
    cutoff.setMonth(cutoff.getMonth() - 13)
    await useDatabase().execute(sql`delete from analytics_hits where occurred_at < ${cutoff.toISOString()}`)
  }

  static async rollupDay(day: string) {
    await useDatabase().execute(sql`
      insert into analytics_daily (day, path, channel, device, pageviews, visitors, sessions, bounces, engaged_ms, outbound, photos)
      select ${day}::date, path, channel, coalesce(device, ''),
        count(*) filter (where event_type = 'pageview')::int,
        count(distinct visitor_key) filter (where event_type = 'pageview')::int,
        count(distinct session_key) filter (where event_type = 'pageview')::int,
        0,
        coalesce(sum(engaged_ms), 0)::bigint,
        count(*) filter (where event_type = 'outbound')::int,
        count(*) filter (where event_type = 'photo')::int
      from analytics_hits
      where occurred_at >= ${day}::date and occurred_at < (${day}::date + interval '1 day') and is_bot = false
      group by path, channel, device
      on conflict (day, path, channel, device) do update set
        pageviews = excluded.pageviews,
        visitors = excluded.visitors,
        sessions = excluded.sessions,
        engaged_ms = excluded.engaged_ms,
        outbound = excluded.outbound,
        photos = excluded.photos
    `)
  }

  static async claimRun(day: string, kind: string) {
    const inserted = await useDatabase().insert(analyticsRuns).values({ day, kind }).onConflictDoNothing().returning()
    return inserted.length > 0
  }

  static async hasRun(day: string, kind: string) {
    const rows = await useDatabase()
      .select({ day: analyticsRuns.day })
      .from(analyticsRuns)
      .where(sql`${analyticsRuns.day} = ${day} and ${analyticsRuns.kind} = ${kind}`)
      .limit(1)
    return rows.length > 0
  }

  static async hasSearchRows(engine: string) {
    const rows = await useDatabase()
      .select({ day: analyticsSearchQueries.day })
      .from(analyticsSearchQueries)
      .where(sql`${analyticsSearchQueries.engine} = ${engine}`)
      .limit(1)
    return rows.length > 0
  }

  static async replaceSearchRows(
    rows: Array<{
      day: string
      engine: string
      page: string
      query: string
      impressions: number
      clicks: number
      position: number | null
    }>,
  ) {
    if (!rows.length) {
      return
    }
    await useDatabase()
      .insert(analyticsSearchQueries)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          analyticsSearchQueries.day,
          analyticsSearchQueries.engine,
          analyticsSearchQueries.page,
          analyticsSearchQueries.query,
        ],
        set: {
          impressions: sql`excluded.impressions`,
          clicks: sql`excluded.clicks`,
          position: sql`excluded.position`,
        },
      })
  }
}
