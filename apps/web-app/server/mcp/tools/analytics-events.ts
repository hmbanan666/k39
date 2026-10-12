import { db } from '@k39/database'
import { z } from 'zod'
import { resolvePeriod } from '../../../shared/analytics'
import { auditedAnalytics } from '../../utils/analytics/report'

export default defineMcpTool({
  name: 'analytics_events',
  description: 'Counts by event type: pageview, engage, outbound, photo.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    period: z.string().optional(),
    type: z.string().optional(),
  },
  handler: async ({ period, type }) => auditedAnalytics('analytics_events', async () => {
    const range = resolvePeriod(period || '28d')
    return { period: range.label, events: await db.analytics.events(range.from, range.to, type) }
  }),
})
