import { db, VenueInputError } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { fetchOverpass } from '../../utils/venues/overpass'
import { saveImportedHours } from '../../utils/venues/write'

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

export default defineStrictMcpTool({
  name: 'venue_import_osm',
  description: 'Import OpenStreetMap cafes, restaurants, bars, fast food, pubs, ice cream, and bakeries as drafts. Pass a point and radiusMeters, or a bbox (south, west, north, east). Dedupes by osmId and never publishes or updates an existing venue. Phone stays empty for explicit official-first source review and a later venue_update. OSM opening hours become an unverified schedule; hoursSkipped lists drafts whose hours could not be stored. Writes an mcp_audits row.',
  inputSchema: {
    area,
    regionSlug: z.string().optional(),
  },
  handler: async ({ area: box, regionSlug }) => {
    const region = regionSlug ? await db.venues.regionBySlug(regionSlug) : null
    if (regionSlug && !region) {
      throw createError({ statusCode: 400, statusMessage: 'Территория каталога не найдена' })
    }
    try {
      const drafts = await fetchOverpass(box)
      const { createdDrafts, ...result } = await db.venues.importDrafts(drafts, region?.id ?? null)
      const hoursSkipped = await saveImportedHours(createdDrafts)
      await auditMcp('venue_import_osm', 'venue', null)
      return { fetched: drafts.length, ...result, hoursSkipped }
    } catch (error) {
      if (error instanceof VenueInputError) {
        throw createError({ statusCode: 400, statusMessage: error.message })
      }
      throw error
    }
  },
})
