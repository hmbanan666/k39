import { z } from 'zod'
import { requireEditorContent } from '../../utils/access'
import { upsertRegion } from '../../utils/mcp/regions'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

const point = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
}).describe('Map center. latitude is -90..90, longitude is -180..180.')

export default defineStrictMcpTool({
  name: 'region_upsert',
  description: 'Create or update a named catalogue area by slug. Membership is not verified settlement or legal-boundary evidence. name is stored as the title. coordinates and center are the same optional { latitude, longitude }. Null clears the center. Omit both to keep it. Writes an mcp_audits row. Does not manage users or settings.',
  inputSchema: {
    slug: z.string().describe('Stable latin slug, such as zelenogradsk'),
    name: z.string().describe('Catalogue-area name, stored as the region title; not a legal municipal claim'),
    shortTitle: z.string().nullable().optional().describe('Optional display anchor/name for the catalogue area, e.g. Зеленоградск; not verified address locality. Null clears it; omit to keep it'),
    description: z.string().nullable().optional(),
    coordinates: point.nullable().optional(),
    center: point.nullable().optional().describe('Alias of coordinates'),
  },
  handler: async (input) => {
    requireEditorContent('edit a region')
    return upsertRegion(input)
  },
})
