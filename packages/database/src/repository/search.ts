import { createId } from '@paralleldrive/cuid2'
import { sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { prefixTsQuery, searchVariants } from '../search-text'
import { searchEvents } from '../tables'

export type SearchKind = 'place' | 'route' | 'collection' | 'quest' | 'venue' | 'hub' | 'city'

export interface SearchResult {
  kind: SearchKind
  path: string
  title: string
  label: string
  region: string
  snippet: string
  score: number
}

export interface SearchEventDraft {
  searchId: string
  eventType: 'search' | 'click'
  visitorKey: string
  sessionKey?: string | null
  isBot?: boolean
  surface?: string | null
  query?: string | null
  normalized?: string | null
  resultCount?: number | null
  position?: number | null
  resultPath?: string | null
  occurredAt?: string
}

const REFINE_MS = 5 * 60 * 1000
const TYPO_SIMILARITY = 0.45

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }
  return (result as { rows?: T[] }).rows ?? []
}

function day(value: Date) {
  return value.toISOString()
}

function snippet(text: string) {
  const plain = text
    .replace(/[#*_>`[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > 180 ? `${plain.slice(0, 177).trimEnd()}…` : plain
}

export class Search {
  /** Ranked public documents for a query (ADR 0030). */
  static async query(input: string, limit = 20): Promise<SearchResult[]> {
    const variants = searchVariants(input)
    if (!variants.length) {
      return []
    }
    const pairs = JSON.stringify(variants.map((v) => ({ v, t: prefixTsQuery(v) })))
    const result = await useDatabase().execute(sql`
      with q as (
        select v, t from jsonb_to_recordset(${pairs}::jsonb) as x(v text, t text)
      ), scored as (
        select d.kind, d.path, d.title, d.label, d.region, d.snippet, d.boost,
          (case when d.doc @@ to_tsquery('russian', q.t) then ts_rank_cd(d.doc, to_tsquery('russian', q.t)) else 0 end)
            + 0.6 * word_similarity(q.v, search_fold(d.title)) as score,
          d.doc @@ to_tsquery('russian', q.t) as hit,
          word_similarity(q.v, search_fold(d.title)) as sim
        from search_documents d cross join q
      )
      select kind, path, title, label, region, snippet, max(score) + max(boost) as score
      from scored
      where hit or sim >= ${TYPO_SIMILARITY}
      group by kind, path, title, label, region, snippet
      order by score desc, title
      limit ${Math.max(1, Math.min(50, limit))}
    `)
    return rowsOf<SearchResult>(result).map((row) => ({
      ...row,
      score: Number(row.score),
      snippet: snippet(row.snippet || ''),
    }))
  }

  /** Stores search and click events. A search within 5 minutes of the last one in the session is a refinement. */
  static async insertEvents(events: SearchEventDraft[]) {
    let stored = 0
    for (const item of events) {
      let refinedFrom: string | null = null
      if (item.eventType === 'search' && item.sessionKey) {
        const at = item.occurredAt ? new Date(item.occurredAt) : new Date()
        const previous = await useDatabase().execute(sql`
          select search_id from search_events
          where session_key = ${item.sessionKey} and event_type = 'search' and search_id <> ${item.searchId}
            and occurred_at >= ${new Date(at.getTime() - REFINE_MS).toISOString()} and occurred_at <= ${at.toISOString()}
          order by occurred_at desc limit 1
        `)
        refinedFrom = rowsOf<{ search_id: string }>(previous)[0]?.search_id ?? null
      }
      if (item.eventType === 'search') {
        const seen = await useDatabase().execute(sql`
          select 1 as ok from search_events where search_id = ${item.searchId} and event_type = 'search' limit 1
        `)
        if (rowsOf(seen).length) {
          continue
        }
      }
      await useDatabase()
        .insert(searchEvents)
        .values({
          id: createId(),
          occurredAt: item.occurredAt,
          searchId: item.searchId,
          eventType: item.eventType,
          visitorKey: item.visitorKey,
          sessionKey: item.sessionKey ?? null,
          isBot: item.isBot ?? false,
          surface: item.surface ?? null,
          query: item.query ?? null,
          normalized: item.normalized ?? null,
          resultCount: item.resultCount ?? null,
          refinedFrom,
          position: item.position ?? null,
          resultPath: item.resultPath ?? null,
        })
      stored += 1
    }
    return stored
  }

  static async purgeRaw(now = new Date()) {
    const cutoff = new Date(now)
    cutoff.setMonth(cutoff.getMonth() - 13)
    await useDatabase().execute(sql`delete from search_events where occurred_at < ${cutoff.toISOString()}`)
  }

  /**
   * Per-search facts: clicked, refined later, exited without a click.
   * Bots are excluded everywhere.
   */
  private static searchesCte(from: Date, to: Date) {
    return sql`
      searches as (
        select s.search_id, s.session_key, s.surface, s.normalized, s.result_count, s.refined_from, s.occurred_at,
          exists (select 1 from search_events c where c.search_id = s.search_id and c.event_type = 'click') as clicked,
          exists (select 1 from search_events n where n.refined_from = s.search_id and n.event_type = 'search') as refined
        from search_events s
        where s.event_type = 'search' and s.is_bot = false
          and s.occurred_at >= ${day(from)} and s.occurred_at < ${day(to)}
      )
    `
  }

  static async totals(from: Date, to: Date) {
    const result = await useDatabase().execute(sql`
      with ${this.searchesCte(from, to)}
      select count(*)::int as searches,
        count(distinct session_key)::int as sessions,
        count(*) filter (where result_count = 0)::int as zero,
        count(*) filter (where clicked)::int as clicked,
        count(*) filter (where refined_from is not null)::int as refinements,
        count(*) filter (where not clicked and not refined)::int as exits
      from searches
    `)
    const row = rowsOf<Record<string, number>>(result)[0] ?? {}
    const searches = Number(row.searches ?? 0)
    const rate = (value: unknown) => (searches ? Math.round((Number(value ?? 0) / searches) * 1000) / 10 : 0)
    return {
      searches,
      sessions: Number(row.sessions ?? 0),
      zeroResults: Number(row.zero ?? 0),
      zeroRate: rate(row.zero),
      clickRate: rate(row.clicked),
      refinementRate: rate(row.refinements),
      exitRate: rate(row.exits),
    }
  }

  /** Top queries, joined with external search demand (GSC, later Yandex) on the normalized text. */
  static async topQueries(from: Date, to: Date, limit = 50) {
    const result = await useDatabase().execute(sql`
      with ${this.searchesCte(from, to)},
      external as (
        select lower(translate(query, 'ёЁ', 'еЕ')) as normalized, sum(impressions)::int as impressions, sum(clicks)::int as clicks
        from analytics_search_queries
        where day >= ${from.toISOString().slice(0, 10)} and day <= ${to.toISOString().slice(0, 10)}
        group by 1
      )
      select s.normalized as query, count(*)::int as searches, count(distinct s.session_key)::int as sessions,
        round(avg(s.result_count)::numeric, 1)::float as avg_results,
        count(*) filter (where s.clicked)::int as clicked,
        count(*) filter (where not s.clicked and not s.refined)::int as exits,
        coalesce(max(e.impressions), 0)::int as external_impressions,
        coalesce(max(e.clicks), 0)::int as external_clicks
      from searches s
      left join external e on e.normalized = s.normalized
      group by s.normalized
      order by searches desc, s.normalized
      limit ${limit}
    `)
    return rowsOf<{
      query: string
      searches: number
      sessions: number
      avg_results: number
      clicked: number
      exits: number
      external_impressions: number
      external_clicks: number
    }>(result).map((row) => ({
      query: row.query,
      searches: row.searches,
      sessions: row.sessions,
      avgResults: Number(row.avg_results ?? 0),
      clicked: row.clicked,
      exits: row.exits,
      externalImpressions: row.external_impressions,
      externalClicks: row.external_clicks,
    }))
  }

  /** Queries that found nothing: content opportunities. */
  static async zeroResults(from: Date, to: Date, limit = 50) {
    const result = await useDatabase().execute(sql`
      with ${this.searchesCte(from, to)},
      external as (
        select lower(translate(query, 'ёЁ', 'еЕ')) as normalized, sum(impressions)::int as impressions, round(avg(position)::numeric, 1)::float as position
        from analytics_search_queries
        where day >= ${from.toISOString().slice(0, 10)} and day <= ${to.toISOString().slice(0, 10)}
        group by 1
      )
      select s.normalized as query, count(*)::int as searches, count(distinct s.session_key)::int as sessions,
        max(s.occurred_at) as last_seen,
        count(*) filter (where s.refined)::int as refined,
        coalesce(max(e.impressions), 0)::int as external_impressions,
        max(e.position) as external_position
      from searches s
      left join external e on e.normalized = s.normalized
      where s.result_count = 0
      group by s.normalized
      order by searches desc, last_seen desc
      limit ${limit}
    `)
    return rowsOf<{
      query: string
      searches: number
      sessions: number
      last_seen: string
      refined: number
      external_impressions: number
      external_position: number | null
    }>(result).map((row) => ({
      query: row.query,
      searches: row.searches,
      sessions: row.sessions,
      lastSeen: new Date(row.last_seen).toISOString(),
      refined: row.refined,
      externalImpressions: row.external_impressions,
      externalPosition: row.external_position == null ? null : Number(row.external_position),
    }))
  }

  /** Click-through by result position among searches that returned results. */
  static async clicksByPosition(from: Date, to: Date) {
    const result = await useDatabase().execute(sql`
      with ${this.searchesCte(from, to)},
      clicks as (
        select c.search_id, min(c.position) as position
        from search_events c
        join searches s on s.search_id = c.search_id
        where c.event_type = 'click' and c.position is not null
        group by c.search_id
      )
      select position, count(*)::int as clicks,
        (select count(*) from searches where result_count > 0)::int as searches
      from clicks
      group by position
      order by position
      limit 20
    `)
    return rowsOf<{ position: number; clicks: number; searches: number }>(result).map((row) => ({
      position: row.position,
      clicks: row.clicks,
      ctr: row.searches ? Math.round((row.clicks / row.searches) * 1000) / 10 : 0,
    }))
  }

  static async surfaces(from: Date, to: Date) {
    const result = await useDatabase().execute(sql`
      with ${this.searchesCte(from, to)}
      select coalesce(surface, '') as surface, count(*)::int as searches,
        count(*) filter (where clicked)::int as clicked
      from searches
      group by 1
      order by searches desc
    `)
    return rowsOf<{ surface: string; searches: number; clicked: number }>(result)
  }

  /** How searching sessions arrived: the entry channel and landing page of the ADR 0013 session. */
  static async arrivals(from: Date, to: Date) {
    const result = await useDatabase().execute(sql`
      with ${this.searchesCte(from, to)},
      sessions as (select distinct session_key from searches where session_key is not null)
      select h.channel, h.landing_path, count(*)::int as sessions
      from sessions s
      join analytics_hits h on h.session_key = s.session_key and h.is_entry = true
      group by h.channel, h.landing_path
      order by sessions desc
      limit 20
    `)
    return rowsOf<{ channel: string; landing_path: string | null; sessions: number }>(result).map((row) => ({
      channel: row.channel,
      landingPath: row.landing_path,
      sessions: row.sessions,
    }))
  }

  static async report(from: Date, to: Date) {
    const [totals, topQueries, zeroResults, positions, surfaces, arrivals] = await Promise.all([
      this.totals(from, to),
      this.topQueries(from, to),
      this.zeroResults(from, to),
      this.clicksByPosition(from, to),
      this.surfaces(from, to),
      this.arrivals(from, to),
    ])
    return { totals, topQueries, zeroResults, positions, surfaces, arrivals }
  }
}
