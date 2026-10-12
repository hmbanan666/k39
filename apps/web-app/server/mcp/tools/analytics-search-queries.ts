import { db } from '@k39/database'
import { z } from 'zod'
import { resolvePeriod } from '../../../shared/analytics'
import { auditedAnalytics } from '../../utils/analytics/report'

export default defineMcpTool({
  name: 'analytics_search_queries',
  description: 'Search queries imported from Yandex Webmaster and Google Search Console. Yandex popular queries have an empty page.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    period: z.string().optional(),
    engine: z.string().optional().describe('yandex or google'),
    page: z.string().optional().describe('Page path or full URL'),
  },
  handler: async ({ period, engine, page }) => auditedAnalytics('analytics_search_queries', async () => {
    const range = resolvePeriod(period || '28d')
    return { period: range.label, queries: await db.analytics.searchQueries(range.from, range.to, engine, page) }
  }),
})
