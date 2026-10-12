import { db } from '@k39/database'
import { z } from 'zod'
import { resolvePeriod, trendPercent } from '../../../shared/analytics'
import { auditedAnalytics } from '../../utils/analytics/report'

export default defineMcpTool({
  name: 'analytics_overview',
  description: 'Visitors, sessions, pageviews, bounce rate, average engaged time, and the change versus the previous period. Bots are excluded.',
  annotations: { readOnlyHint: true },
  inputSchema: { period: z.string().optional().describe('24h, 7d, 28d, or 90d') },
  handler: async ({ period }) => auditedAnalytics('analytics_overview', async () => {
    const range = resolvePeriod(period || '28d')
    const [current, previous] = await Promise.all([
      db.analytics.overview(range.from, range.to),
      db.analytics.overview(range.previousFrom, range.previousTo),
    ])
    return {
      period: range.label,
      ...current,
      trend: {
        visitors: trendPercent(current.visitors, previous.visitors),
        sessions: trendPercent(current.sessions, previous.sessions),
        pageviews: trendPercent(current.pageviews, previous.pageviews),
      },
    }
  }),
})
