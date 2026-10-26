import { db } from '@k39/database'
import { z } from 'zod'
import { resolvePeriod } from '../../../shared/analytics'
import { auditedAnalytics } from '../../utils/analytics/report'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'analytics_landing_pages',
  description: 'Entry pages. Default channel is organic, which includes Yandex, Google, and other search.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    period: z.string().optional(),
    channel: z.string().optional().describe('organic, organic:yandex, organic:google, or another channel'),
  },
  handler: async ({ period, channel }) =>
    auditedAnalytics('analytics_landing_pages', async () => {
      const range = resolvePeriod(period || '28d')
      return { period: range.label, pages: await db.analytics.landingPages(range.from, range.to, channel || 'organic') }
    }),
})
