import { db } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { recomputeTownPriceBands } from '../../utils/venues/price-band'

export default defineStrictMcpTool({
  name: 'venue_price_bands_recompute',
  description: 'Recompute the stored price band (low, mid, high, or null) for every venue in a catalogue area. The band stays null until at least three of that venue\'s prices have a catalogue-area comparison. One venue\'s prices change the comparison for the others. Publishing a venue does this too. The badge reads the stored band. Does not list or filter the public site.',
  inputSchema: {
    regionSlug: z.string(),
  },
  handler: async ({ regionSlug }) => {
    const region = await db.venues.regionBySlug(regionSlug)
    if (!region) {
      throw createError({ statusCode: 400, statusMessage: 'Территория каталога не найдена' })
    }
    const venues = await recomputeTownPriceBands(region.id)
    await auditMcp('venue_price_bands_recompute', 'region', region.id)
    return { regionSlug, venues }
  },
})
