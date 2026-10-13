import { z } from 'zod'
import { createVenue } from '../../utils/venues/mutate'
import { venueFields } from '../../utils/venues/schema'

export default defineMcpTool({
  name: 'venue_create',
  description: 'Create a venue. status defaults to draft. A published description must be 300 to 600 characters. Never used by venue_import_osm. The write is an mcp_audits row.',
  inputSchema: {
    slug: z.string(),
    name: z.string().min(1).max(200),
    kind: venueFields.kind,
    cuisine: venueFields.cuisine,
    regionSlug: venueFields.regionSlug,
    address: venueFields.address,
    latitude: venueFields.latitude,
    longitude: venueFields.longitude,
    priceLevel: venueFields.priceLevel,
    avgCheck: venueFields.avgCheck,
    hours: venueFields.hours,
    phone: venueFields.phone,
    website: venueFields.website,
    socials: venueFields.socials,
    description: venueFields.description,
    sources: venueFields.sources,
    status: venueFields.status,
    lastVerifiedAt: venueFields.lastVerifiedAt,
    osmId: venueFields.osmId,
    seoTitle: venueFields.seoTitle,
    seoDescription: venueFields.seoDescription,
    mediaIds: venueFields.mediaIds,
  },
  handler: async (input) => createVenue(input),
})
