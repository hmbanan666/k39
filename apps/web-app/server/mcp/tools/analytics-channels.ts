import { db } from '@k39/database'
import { z } from 'zod'
import { resolvePeriod } from '../../../shared/analytics'
import { auditedAnalytics } from '../../utils/analytics/report'

export default defineMcpTool({
  name: 'analytics_channels',
  description: 'Pageviews and visitors by channel for a period.',
  annotations: { readOnlyHint: true },
  inputSchema: { period: z.string().optional() },
  handler: async ({ period }) => auditedAnalytics('analytics_channels', async () => {
    const range = resolvePeriod(period || '28d')
    return { period: range.label, channels: await db.analytics.channels(range.from, range.to) }
  }),
})
