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

function num(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export class Analytics {
  static async insertHits(hits: AnalyticsHitDraft[]) {
    if (!hits.length) {
      return []
    }
    return useDatabase().insert(analyticsHits).values(hits.map((row) => ({
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
      referrer: row.referrer?.slice(0, 1000) ?? null,
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
      target: row.target ?? null,
    }))).returning({ id: analyticsHits.id })
  }

  static async latestSession(visitorKey: string) {
    const result = await useDatabase().execute(sql`
      select session_key, occurred_at, landing_path, channel
      from analytics_hits
      where visitor_key = ${visitorKey} and is_bot = false and event_type = 'pageview'
      order by occurred_at desc
      limit 1
    `)
    const row = rowsOf<{ session_key: string, occurred_at: string, landing_path: string | null, channel: string }>(result)[0]
    return row
      ? { sessionKey: row.session_key, occurredAt: row.occurred_at, landingPath: row.landing_path, channel: row.channel }
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
    const clean = path.split('?')[0] || '/'
    const parts = clean.split('/').filter(Boolean)
    if (parts.length === 1 && parts[0]) {
      const result = await useDatabase().execute(sql`select id from places where slug = ${parts[0]} limit 1`)
      const id = rowsOf<{ id: string }>(result)[0]?.id ?? null
      return { placeId: id, routeId: null as string | null }
    }
    if (parts[0] === 'marshruty' && parts[1]) {
      const result = await useDatabase().execute(sql`select id from routes where slug = ${parts[1]} limit 1`)
      const id = rowsOf<{ id: string }>(result)[0]?.id ?? null
      return { placeId: null as string | null, routeId: id }
    }
    return { placeId: null as string | null, routeId: null as string | null }
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
    return rowsOf<{ channel: string, pageviews: number, visitors: number }>(result)
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
    return rowsOf<{ path: string, pageviews: number, visitors: number }>(result)
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
    return rowsOf<{ path: string, pageviews: number }>(result)
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
    return rowsOf<{ host: string, pageviews: number }>(result)
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
    return rowsOf<{ engine: string, query: string, page: string, impressions: number, clicks: number, position: number | null }>(result)
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
    return rowsOf<{ type: string, count: number }>(result)
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

  static async venueImpressions(from: string, to: string, slug?: string) {
    const target = slug ? `venue:${slug}` : null
    const result = await useDatabase().execute(sql`
      select target,
        count(*)::int as impressions,
        count(distinct visitor_key)::int as visitors
      from analytics_hits
      where is_bot = false
        and event_type = 'impression'
        and target like 'venue:%'
        and occurred_at >= ${from}
        and occurred_at < ${to}
        and (${target}::varchar is null or target = ${target})
      group by target
      order by impressions desc
    `)
    return rowsOf<{ target: string, impressions: number, visitors: number }>(result).map((row) => ({
      slug: String(row.target).slice('venue:'.length),
      impressions: num(row.impressions),
      visitors: num(row.visitors),
    }))
  }

  static async claimRun(day: string, kind: string) {
    const inserted = await useDatabase().insert(analyticsRuns).values({ day, kind }).onConflictDoNothing().returning()
    return inserted.length > 0
  }

  static async replaceSearchRows(rows: Array<{ day: string, engine: string, page: string, query: string, impressions: number, clicks: number, position: number | null }>) {
    if (!rows.length) {
      return
    }
    await useDatabase().insert(analyticsSearchQueries).values(rows).onConflictDoUpdate({
      target: [analyticsSearchQueries.day, analyticsSearchQueries.engine, analyticsSearchQueries.page, analyticsSearchQueries.query],
      set: {
        impressions: sql`excluded.impressions`,
        clicks: sql`excluded.clicks`,
        position: sql`excluded.position`,
      },
    })
  }
}
