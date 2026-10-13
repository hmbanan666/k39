import { db } from '@k39/database'
import { z } from 'zod'
import { resolvePeriod } from '../../../shared/analytics'
import { auditedAnalytics } from '../../utils/analytics/report'

export default defineMcpTool({
  name: 'venue_stats',
  description: 'Impression counts for venues shown in the nearby block. Cookieless, bots excluded. Optional slug and period such as 28d.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    slug: z.string().optional(),
    period: z.string().optional(),
  },
  handler: async ({ slug, period }) => auditedAnalytics('venue_stats', async () => {
    const range = resolvePeriod(period || '28d')
    const rows = await db.analytics.venueImpressions(range.from.toISOString(), range.to.toISOString(), slug)
    if (!rows.length) {
      return { period: range.label, venues: slug ? [{ slug, impressions: 0, visitors: 0 }] : [] }
    }
    const names = await Promise.all(rows.map(async (row) => {
      const venue = await db.venues.bySlug(row.slug)
      return { ...row, name: venue?.name ?? null }
    }))
    return { period: range.label, venues: names }
  }),
})
