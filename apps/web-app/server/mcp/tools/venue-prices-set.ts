import { db } from '@k39/database'
import { z } from 'zod'
import { contentScope } from '../../utils/access'
import { setVenuePrices } from '../../utils/facts/sync'
import { auditMcp } from '../../utils/mcp/audit'
import { recomputeTownPriceBands } from '../../utils/venues/price-band'
import { venuePricesWriteSchema } from '../../utils/venues/prices'

export default defineMcpTool({
  name: 'venue_prices_set',
  description: 'Replace a venue\'s «Ориентиры цен»: prices for items from the shared catalog (price_items_list). Only prices from the venue\'s official menu (sourceKind official, with sourceUrl) or sent by the owner (sourceKind owner). An official menu is a page or PDF on the venue site, or a document on drive.google.com, docs.google.com, disk.yandex.*, or yadi.sk. The venue\'s own VK page (vk.com or vk.ru) counts only when the venue has no website and the price community matches a VK link in socials (the same screen name, or the same numeric id from club, public, event, wall-, market-, album-, photo-, doc-, topic-, or video-). A w= or z= object is that owner, and the path screen name is ignored. A section path such as feed, away.php, search, or im is not a screen name. Store sourceKind official and that VK URL; the fact is official_social. variant is a size, not a price: no ₽, no руб, and no rub. sourceUrl must not name a banned site. Never invent a price or take one from Yandex Maps, 2GIS, Google Maps, OSM, aggregators, or delivery apps (Yandex Eda, Delivery Club, tomesto). An empty list clears them; the module hides without prices. Prices older than a year are not shown.',
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
    if (contentScope() === 'draft' && venue.status !== 'draft') {
      throw createError({ statusCode: 409, statusMessage: 'Draft token cannot edit prices on a published venue. The live page was not changed.' })
    }
    try {
      const saved = await setVenuePrices(venue.id, prices, 'mcp', venue.status)
      const bands = await recomputeTownPriceBands(venue.regionId)
      await auditMcp('venue_prices_set', 'venue', venue.id)
      return { venueId: venue.id, prices: saved.prices, priceBands: bands, ownerConflicts: saved.conflicts }
    } catch (error) {
      throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Не удалось сохранить цены' })
    }
  },
})
