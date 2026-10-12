import { db } from '@k39/database'
import { resolvePeriod, trendPercent } from '../../../shared/analytics'
import { auditMcp } from '../mcp/audit'

export async function analyticsReport(period?: string) {
  const range = resolvePeriod(period || '28d')
  const [current, previous, channels, topPages, landing, referrers, queries, events, realtime] = await Promise.all([
    db.analytics.overview(range.from, range.to),
    db.analytics.overview(range.previousFrom, range.previousTo),
    db.analytics.channels(range.from, range.to),
    db.analytics.topPages(range.from, range.to),
    db.analytics.landingPages(range.from, range.to, 'organic'),
    db.analytics.referrers(range.from, range.to),
    db.analytics.searchQueries(range.from, range.to),
    db.analytics.events(range.from, range.to),
    db.analytics.realtime(),
  ])
  const max = channels[0]?.pageviews || 1
  return {
    period: range.label,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    overview: {
      ...current,
      trend: {
        visitors: trendPercent(current.visitors, previous.visitors),
        sessions: trendPercent(current.sessions, previous.sessions),
        pageviews: trendPercent(current.pageviews, previous.pageviews),
      },
    },
    channels: channels.map((row) => ({ ...row, share: Math.round((row.pageviews / max) * 100) })),
    topPages,
    landing,
    referrers,
    queries,
    events,
    realtime,
  }
}

export async function auditedAnalytics<T>(tool: string, run: () => Promise<T>) {
  const result = await run()
  await auditMcp(tool, 'analytics', null)
  return result
}
