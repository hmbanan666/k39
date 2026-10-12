import { z } from 'zod'
import { upsertRegion } from '../../utils/mcp/regions'

const point = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
}).describe('Map center. latitude is -90..90, longitude is -180..180.')

export default defineMcpTool({
  name: 'region_upsert',
  description: 'Create or update a region by slug. name is stored as the title. coordinates and center are the same optional { latitude, longitude }. Null clears the center. Omit both to keep it. Writes an mcp_audits row. Does not manage users or settings.',
  inputSchema: {
    slug: z.string().describe('Stable latin slug, such as zelenogradsk'),
    name: z.string().describe('Official name, stored as the region title'),
    description: z.string().nullable().optional(),
    coordinates: point.nullable().optional(),
    center: point.nullable().optional().describe('Alias of coordinates'),
  },
  handler: async (input) => upsertRegion(input),
})
