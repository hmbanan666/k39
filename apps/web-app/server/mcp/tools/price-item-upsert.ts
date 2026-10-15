import { db } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'price_item_upsert',
  description: 'Add or rename a benchmark item in the shared price catalog. Keep the catalog small and familiar: items people compare between venues.',
  inputSchema: {
    slug: z.string().regex(/^[a-z0-9-]+$/).describe('Latin slug, e.g. cappuccino'),
    title: z.string().min(1).max(80).describe('Russian name, e.g. Капучино'),
    category: z.string().min(1).max(40).describe('coffee, bakery, dessert, breakfast, tea, drinks, beer, pizza, burger, street-food, sushi, salad, soup, pasta, main, fish, lunch'),
    defaultVariant: z.string().max(40).nullable().optional().describe('Usual size, e.g. 300 мл or 30 см'),
    sortOrder: z.number().int().min(0).optional(),
    image: z.string().max(300).nullable().optional().describe('Optional custom picture: a site path or https URL. Null clears it. Omit to keep the stored picture. When empty, a food sticker shows for a catalog slug that has one, otherwise the line icon.'),
  },
  handler: async (input) => {
    const row = await db.prices.upsertItem(input)
    await auditMcp('price_item_upsert', 'price_item', row?.id ?? null)
    return { item: row ?? null }
  },
})
