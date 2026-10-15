import { z } from 'zod'

/** One «Ориентиры цен» row. Shared by venue_prices_set and the owner cabinet. */
export const venuePriceWriteSchema = z.object({
  item: z.string().describe('Catalog slug, e.g. cappuccino'),
  variant: z.string().max(40).nullable().optional().describe('Size as on the menu, e.g. 250 мл. Omitted: the catalog default'),
  priceRub: z.number().int().min(1).max(100000),
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/).describe('ISO date the price was seen'),
  sourceKind: z.enum(['official', 'owner']),
  sourceTitle: z.string().min(1).max(160).describe('e.g. «Меню на сайте заведения»'),
  sourceUrl: z.string().url().nullable().optional(),
})

export const venuePricesWriteSchema = z.array(venuePriceWriteSchema).max(12)

/** An owner cannot mark a row official or attach a source URL. */
export function asOwnerPrices(rows: z.infer<typeof venuePricesWriteSchema>) {
  return rows.map((row) => ({
    item: row.item,
    variant: row.variant,
    priceRub: row.priceRub,
    checkedAt: row.checkedAt,
    sourceKind: 'owner' as const,
    sourceTitle: row.sourceTitle,
    sourceUrl: null,
  }))
}
