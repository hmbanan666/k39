import { z } from 'zod'
import { auditedAnalytics } from '../../utils/analytics/report'
import { searchZeroResults } from '../../utils/search/report'

export default defineMcpTool({
  name: 'search_zero_results',
  description: 'Site search queries that returned nothing, with search and session counts, how many were refined, and Google/Yandex impressions for the same text. These are content opportunities: a missing page, or a synonym to add to an existing summary.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    period: z.string().optional().describe('24h, 7d, 28d, or 90d'),
    limit: z.number().int().min(1).max(200).optional(),
  },
  handler: async ({ period, limit }) => auditedAnalytics('search_zero_results', () => searchZeroResults(period, limit ?? 50)),
})
