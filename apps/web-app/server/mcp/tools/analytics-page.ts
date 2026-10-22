import { db } from '@k39/database'
import { z } from 'zod'
import { resolvePeriod } from '../../../shared/analytics'
import { auditedAnalytics } from '../../utils/analytics/report'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'analytics_page',
  description: 'One place or route slug: pageviews, sources, search queries, and engagement.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    slug: z.string(),
    period: z.string().optional(),
  },
  handler: async ({ slug, period }) => auditedAnalytics('analytics_page', async () => {
    const range = resolvePeriod(period || '28d')
    return db.analytics.pageReport(slug, range.from, range.to)
  }),
})
