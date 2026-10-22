import { z } from 'zod'
import { auditedAnalytics } from '../../utils/analytics/report'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { searchReport } from '../../utils/search/report'

export default defineStrictMcpTool({
  name: 'search_report',
  description: 'Site search (/poisk) report: totals (searches, zero-result, click, refinement and exit rates), top queries with Google/Yandex impressions for the same text, zero-result queries, click-through by position, surfaces, and how searching sessions arrived. Bots are excluded.',
  annotations: { readOnlyHint: true },
  inputSchema: { period: z.string().optional().describe('24h, 7d, 28d, or 90d') },
  handler: async ({ period }) => auditedAnalytics('search_report', () => searchReport(period)),
})
