import { db } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'
import { recomputeTownPriceBands } from '../../utils/venues/price-band'
import { venuePricesWriteSchema } from '../../utils/venues/prices'

export default defineMcpTool({
  name: 'venue_prices_set',
  description: 'Replace a venue\'s «Ориентиры цен»: prices for items from the shared catalog (price_items_list). Only prices from the venue\'s official public menu, site or socials (sourceKind official, with sourceUrl), or sent by the owner (sourceKind owner). Never invent or take from aggregators. An empty list clears them; the module hides without prices. Prices older than a year are not shown.',
  inputSchema: {
    venueId: z.string().optional(),
    slug: z.string().optional(),
    prices: venuePricesWriteSchema,
  },
  handler: async ({ venueId, slug, prices }) => {
    const venue = venueId ? await db.venues.byId(venueId) : slug ? await db.venues.bySlug(slug) : null
    if (!venue) {
      throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
    }
    try {
      const saved = await db.prices.setForVenue(venue.id, prices)
      const bands = await recomputeTownPriceBands(venue.regionId)
      await auditMcp('venue_prices_set', 'venue', venue.id)
      return { venueId: venue.id, prices: saved, priceBands: bands }
    } catch (error) {
      throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Не удалось сохранить цены' })
    }
  },
})
