import { db } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'venue_prices_set',
  description: 'Replace a venue\'s «Ориентиры цен»: prices for items from the shared catalog (price_items_list). Only prices from the venue\'s official public menu, site or socials (sourceKind official, with sourceUrl), or sent by the owner (sourceKind owner). Never invent or take from aggregators. An empty list clears them; the module hides without prices. Prices older than a year are not shown.',
  inputSchema: {
    venueId: z.string().optional(),
    slug: z.string().optional(),
    prices: z.array(z.object({
      item: z.string().describe('Catalog slug, e.g. cappuccino'),
      variant: z.string().max(40).nullable().optional().describe('Size as on the menu, e.g. 250 мл. Omitted: the catalog default'),
      priceRub: z.number().int().min(1).max(100000),
      checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/).describe('ISO date the price was seen'),
      sourceKind: z.enum(['official', 'owner']),
      sourceTitle: z.string().min(1).max(160).describe('e.g. «Меню на сайте заведения»'),
      sourceUrl: z.string().url().nullable().optional(),
    })).max(12),
  },
  handler: async ({ venueId, slug, prices }) => {
    const venue = venueId ? await db.venues.byId(venueId) : slug ? await db.venues.bySlug(slug) : null
    if (!venue) {
      throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
    }
    try {
      const saved = await db.prices.setForVenue(venue.id, prices)
      await auditMcp('venue_prices_set', 'venue', venue.id)
      return { venueId: venue.id, prices: saved }
    } catch (error) {
      throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Не удалось сохранить цены' })
    }
  },
})
