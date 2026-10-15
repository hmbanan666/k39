import { db, isStale } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'venues_list',
  description: 'List venues. Filters: regionSlug, kind, status, stale (lastVerifiedAt missing or older than 180 days), and near { latitude, longitude, radiusKm }.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    regionSlug: z.string().optional(),
    kind: z.string().optional(),
    status: z.enum(['draft', 'published', 'closed', 'archived']).optional(),
    stale: z.boolean().optional(),
    near: z.object({
      latitude: z.number(),
      longitude: z.number(),
      radiusKm: z.number().positive().max(100),
    }).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  handler: async (input) => {
    const region = input.regionSlug ? await db.venues.regionBySlug(input.regionSlug) : null
    if (input.regionSlug && !region) {
      throw createError({ statusCode: 400, statusMessage: 'Регион не найден' })
    }
    const rows = await db.venues.list({
      regionId: region?.id,
      kind: input.kind,
      status: input.status,
      stale: input.stale,
      near: input.near,
      limit: input.limit,
    })
    await auditMcp('venues_list', 'venue', null)
    const now = new Date()
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      status: row.status,
      regionId: row.regionId,
      latitude: row.latitude,
      longitude: row.longitude,
      lastVerifiedAt: row.lastVerifiedAt,
      priceBand: row.priceBand,
      priceBandComputedAt: row.priceBandComputedAt,
      priceBandBasis: row.priceBandBasis,
      stale: isStale(row.lastVerifiedAt, now),
      distanceKm: row.distanceKm,
      osmId: row.osmId,
    }))
  },
})
