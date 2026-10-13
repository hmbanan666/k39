import type { VenueKind, VenueStatus } from '@k39/database'
import { db } from '@k39/database'
import { z } from 'zod'
import { venueIsStale } from '../../../shared/venues'
import { venueKindSchema, venueStatusSchema } from '../../utils/venues/schema'

export default defineMcpTool({
  name: 'venues_list',
  description: 'List venues. Filters: region slug, kind, status, stale, and near a point (latitude, longitude, radiusKm). Paginated.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    region: z.string().optional(),
    kind: venueKindSchema.optional(),
    status: venueStatusSchema.optional(),
    stale: z.boolean().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    radiusKm: z.number().positive().max(50).optional(),
    query: z.string().optional(),
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(50).optional(),
  },
  handler: async (input) => {
    const near = input.latitude != null && input.longitude != null
      ? { latitude: input.latitude, longitude: input.longitude, radiusKm: input.radiusKm ?? 2 }
      : undefined
    const page = input.page ?? 1
    const pageSize = input.pageSize ?? 20
    const result = await db.venues.list({
      regionSlug: input.region,
      kind: input.kind as VenueKind | undefined,
      status: input.status as VenueStatus | undefined,
      stale: input.stale,
      near,
      query: input.query,
      page,
      pageSize,
    })
    return {
      ...result,
      page,
      pageSize,
      items: result.items.map((item) => ({
        ...item,
        stale: venueIsStale(item.lastVerifiedAt),
        path: `/zavedeniya/${item.slug}`,
      })),
    }
  },
})
