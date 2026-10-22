import { db, VenueInputError } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'
import { fetchOverpass } from '../../utils/venues/overpass'
import { planVenueSchedule, saveVenueSchedule } from '../../utils/venues/write'

const area = z.union([
  z.object({
    latitude: z.number(),
    longitude: z.number(),
    radiusMeters: z.number(),
  }),
  z.object({
    south: z.number(),
    west: z.number(),
    north: z.number(),
    east: z.number(),
  }),
])

export default defineMcpTool({
  name: 'venue_import_osm',
  description: 'Import OpenStreetMap cafes, restaurants, bars, fast food, pubs, ice cream, and bakeries as drafts. Pass a point and radiusMeters, or a bbox (south, west, north, east). Dedupes by osmId and never publishes. OSM opening hours become an unverified schedule. Writes an mcp_audits row.',
  inputSchema: {
    area,
    regionSlug: z.string().optional(),
  },
  handler: async ({ area: box, regionSlug }) => {
    const region = regionSlug ? await db.venues.regionBySlug(regionSlug) : null
    if (regionSlug && !region) {
      throw createError({ statusCode: 400, statusMessage: 'Регион не найден' })
    }
    try {
      const drafts = await fetchOverpass(box)
      const result = await db.venues.importDrafts(drafts, region?.id ?? null)
      const created = new Set(result.created)
      for (const draft of drafts) {
        const row = await db.venues.byOsmId(draft.osmId)
        if (!row || !created.has(row.id)) {
          continue
        }
        const schedule = await planVenueSchedule({ id: row.id, lastVerifiedAt: null }, { hours: draft.hours })
        await saveVenueSchedule(row, schedule && { ...schedule, sourceUrl: draft.sources[0]?.url ?? null, verifiedAt: null }, 'mcp')
      }
      await auditMcp('venue_import_osm', 'venue', null)
      return { fetched: drafts.length, ...result }
    } catch (error) {
      if (error instanceof VenueInputError) {
        throw createError({ statusCode: 400, statusMessage: error.message })
      }
      throw error
    }
  },
})
