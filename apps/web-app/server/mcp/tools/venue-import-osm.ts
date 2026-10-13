import { z } from 'zod'
import { importOsmVenues } from '../../utils/venues/mutate'

export default defineMcpTool({
  name: 'venue_import_osm',
  description: 'Pull cafes, restaurants, bars, pubs, fast food, ice cream, and bakeries from Overpass for a bbox (south, west, north, east) or a point plus radius in meters. Creates draft venues with osmId. Existing osmId rows are skipped. Never publishes.',
  inputSchema: {
    south: z.number().optional(),
    west: z.number().optional(),
    north: z.number().optional(),
    east: z.number().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    radius: z.number().optional().describe('Meters, max 20000. Default 1000 when a point is set.'),
  },
  handler: async (input) => importOsmVenues(input),
})
