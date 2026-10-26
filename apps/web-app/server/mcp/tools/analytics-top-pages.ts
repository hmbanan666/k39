import { db } from '@k39/database'
import { z } from 'zod'
import { resolvePeriod } from '../../../shared/analytics'
import { auditedAnalytics } from '../../utils/analytics/report'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'analytics_top_pages',
  description: 'Top pages by pageviews. Optional channel filter such as organic:yandex or direct.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    period: z.string().optional(),
    channel: z.string().optional(),
  },
  handler: async ({ period, channel }) =>
    auditedAnalytics('analytics_top_pages', async () => {
      const range = resolvePeriod(period || '28d')
      return { period: range.label, pages: await db.analytics.topPages(range.from, range.to, channel) }
    }),
})
