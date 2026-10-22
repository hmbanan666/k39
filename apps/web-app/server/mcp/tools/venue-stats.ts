import { db } from '@k39/database'
import { z } from 'zod'
import { resolvePeriod } from '../../../shared/analytics'
import { auditMcp } from '../../utils/mcp/audit'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'venue_stats',
  description: 'Cookieless venue impressions from nearby blocks and pageviews of venue pages. Pass id or slug for one venue. period is like 28d. Writes an mcp_audits row.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
    period: z.string().optional(),
  },
  handler: async ({ id, slug, period }) => {
    const venue = id ? await db.venues.byId(id) : slug ? await db.venues.bySlug(slug) : null
    if ((id || slug) && !venue) {
      throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
    }
    const range = resolvePeriod(period || '28d')
    const rows = await db.analytics.venueStats(venue?.id ?? null, range.from, range.to)
    await auditMcp('venue_stats', 'venue', venue?.id ?? null)
    return {
      period: range.label,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      venues: rows,
    }
  },
})
