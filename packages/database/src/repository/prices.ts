import { and, asc, desc, eq, gte } from 'drizzle-orm'
import { useDatabase } from '../database'
import { priceItems, venuePrices, venues } from '../tables'

export type PriceSourceKind = 'official' | 'owner'

export interface VenuePriceInput {
  item: string
  variant?: string | null
  priceRub: number
  checkedAt: string
  sourceKind: PriceSourceKind
  sourceTitle: string
  sourceUrl?: string | null
}

/** Prices older than this are not shown. */
export const PRICE_FRESH_DAYS = 365

/** A catalog picture is a site path or an https URL. Empty clears it. */
export function normalizePriceItemImage(value: string | null | undefined) {
  const text = value?.trim() ?? ''
  if (!text) {
    return null
  }
  const sitePath = text.startsWith('/') && !text.startsWith('//') && !text.includes('..')
  if (sitePath || text.startsWith('https://')) {
    return text
  }
  throw new Error('Картинка позиции: путь от корня сайта или https-ссылка')
}

function freshCutoff(now = new Date()) {
  return new Date(now.getTime() - PRICE_FRESH_DAYS * 86_400_000).toISOString().slice(0, 10)
}

export class Prices {
  static async items() {
    return useDatabase().select().from(priceItems).orderBy(asc(priceItems.sortOrder), asc(priceItems.slug))
  }

  static async upsertItem(input: { slug: string, title: string, category: string, defaultVariant?: string | null, sortOrder?: number, image?: string | null }) {
    const image = input.image === undefined ? undefined : normalizePriceItemImage(input.image)
    const values = {
      slug: input.slug.trim().toLowerCase(),
      title: input.title.trim(),
      category: input.category.trim().toLowerCase(),
      defaultVariant: input.defaultVariant?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      image: image ?? null,
    }
    const [row] = await useDatabase().insert(priceItems).values(values).onConflictDoUpdate({
      target: priceItems.slug,
      set: {
        title: values.title,
        category: values.category,
        defaultVariant: values.defaultVariant,
        sortOrder: values.sortOrder,
        ...(image === undefined ? {} : { image }),
      },
    }).returning()
    return row
  }

  /** Every stored price of a venue, fresh or not (for editors). */
  static async forVenue(venueId: string) {
    return useDatabase().select({
      id: venuePrices.id,
      item: priceItems.slug,
      title: priceItems.title,
      category: priceItems.category,
      image: priceItems.image,
      variant: venuePrices.variant,
      priceRub: venuePrices.priceRub,
      checkedAt: venuePrices.checkedAt,
      sourceKind: venuePrices.sourceKind,
      sourceTitle: venuePrices.sourceTitle,
      sourceUrl: venuePrices.sourceUrl,
    }).from(venuePrices).innerJoin(priceItems, eq(venuePrices.itemId, priceItems.id)).where(eq(venuePrices.venueId, venueId)).orderBy(asc(priceItems.sortOrder), asc(venuePrices.variant))
  }

  /** Prices checked within PRICE_FRESH_DAYS, for the public page. */
  static async freshForVenue(venueId: string, now = new Date()) {
    const rows = await Prices.forVenue(venueId)
    const cutoff = freshCutoff(now)
    return rows.filter((row) => row.checkedAt >= cutoff)
  }

  /** One item across published venues, cheapest first. Drafts, closed and archived stay out, so comparisons and /ceny indexing use this count. */
  static async forItem(slug: string, now = new Date()) {
    return useDatabase().select({
      venueId: venues.id,
      venueSlug: venues.slug,
      venueName: venues.name,
      regionId: venues.regionId,
      variant: venuePrices.variant,
      priceRub: venuePrices.priceRub,
      checkedAt: venuePrices.checkedAt,
    }).from(venuePrices).innerJoin(priceItems, eq(venuePrices.itemId, priceItems.id)).innerJoin(venues, eq(venuePrices.venueId, venues.id)).where(and(eq(priceItems.slug, slug), eq(venues.status, 'published'), gte(venuePrices.checkedAt, freshCutoff(now)))).orderBy(asc(venuePrices.priceRub), desc(venuePrices.checkedAt))
  }

  /** Replaces a venue's prices. Unknown catalog items fail the whole write. */
  static async setForVenue(venueId: string, input: VenuePriceInput[]) {
    const db = useDatabase()
    const catalog = new Map((await Prices.items()).map((row) => [row.slug, row]))
    const rows = input.map((row) => {
      const item = catalog.get(row.item.trim().toLowerCase())
      if (!item) {
        throw new Error(`Нет такой позиции в каталоге: ${row.item}`)
      }
      if (row.sourceKind === 'official' && !row.sourceUrl?.trim()) {
        throw new Error(`Нужна ссылка на официальный источник: ${row.item}`)
      }
      return {
        venueId,
        itemId: item.id,
        variant: row.variant?.trim() || item.defaultVariant || '',
        priceRub: Math.round(row.priceRub),
        checkedAt: row.checkedAt.slice(0, 10),
        sourceKind: row.sourceKind,
        sourceTitle: row.sourceTitle.trim(),
        sourceUrl: row.sourceUrl?.trim() || null,
      }
    })
    await db.transaction(async (tx) => {
      await tx.delete(venuePrices).where(eq(venuePrices.venueId, venueId))
      if (rows.length) {
        await tx.insert(venuePrices).values(rows)
      }
    })
    return Prices.forVenue(venueId)
  }
}
