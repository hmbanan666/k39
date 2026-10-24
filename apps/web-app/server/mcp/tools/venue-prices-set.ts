import { db } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { writeVenuePrices } from '../../utils/venues/pending'
import { venuePricesWriteSchema } from '../../utils/venues/prices'

export default defineStrictMcpTool({
  name: 'venue_prices_set',
  description: 'On a published or closed venue a draft token stages this list in content_drafts for editor review (ADR 0047); live prices and town bands stay. An empty staged list is a clear. Archived venues refuse the draft token. Replace a venue\'s «Ориентиры цен»: prices for items from the shared catalog (price_items_list). Only prices from the venue\'s official menu (sourceKind official, with sourceUrl) or sent by the owner (sourceKind owner). An official menu is a page or PDF on the venue site, or a document on drive.google.com, docs.google.com, disk.yandex.*, or yadi.sk. The venue\'s own VK page (vk.com or vk.ru) counts only when the venue has no website and the price community matches a VK link in socials (the same screen name, or the same numeric id from club, public, event, wall-, market-, album-, photo-, doc-, topic-, video-, or product-). A screen-name link such as vk.com/cafe matches an album-, photo-, wall-, or market- URL only when venue_update has set vkCommunityId to that number; a club, public, or event link already carries it. Do not add a vk.com/club link to socials for that. A w= or z= object is that owner, and the path screen name is ignored. A section path such as feed, away.php, search, or im is not a screen name. Store sourceKind official and that VK URL; the fact is official_social. variant is a size, not a price: no ₽, no руб, and no rub. sourceUrl must not name a banned site. Never invent a price or take one from Yandex Maps, 2GIS, Google Maps, OSM, aggregators, or delivery apps (Yandex Eda, Delivery Club, tomesto). An empty list clears them; the module hides without prices. Prices older than a year are not shown. Public display also requires an explicit prices module; this writer never inserts or reorders modules. Returns warnings: [{code: prices_hidden_missing_module, message}] when usable official prices would be hidden because no prices block renders; otherwise warnings is []. Pending feedback uses staged prices/modules and describes the result after editor application; immediate feedback uses actual saved rows and the public fact overlay, including owner conflicts.',
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
      const saved = await writeVenuePrices(venue.id, prices)
      await auditMcp('venue_prices_set', 'venue', venue.id)
      return saved
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error
      }
      throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Не удалось сохранить цены' })
    }
  },
})
