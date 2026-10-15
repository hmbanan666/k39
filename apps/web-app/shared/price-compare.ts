import type { FoodStickerSlug } from './food-stickers'
import { inTown } from './eat-now'
import { isFoodStickerSlug } from './food-stickers'
import { pageTitle } from './seo'

/**
 * «Ориентиры цен» (docs/venue-modules.md).
 * Comparison is pure: the server loads `db.prices.forItem` and calls these
 * helpers, so the HTML already contains the conclusion.
 */

/** Below this many venues the card refuses to rank the price. */
export const PRICE_COMPARE_MIN = 3

/** A /ceny listing stays noindex until about this many venues have a price. */
export const PRICE_INDEX_MIN = 5

export const PRICE_FEW_DATA = 'пока мало данных для сравнения'
export const PRICE_TOP = 'топ-3 по цене в регионе'

const CHEAP_RATIO = 0.9
const EXPENSIVE_RATIO = 1.1

export type PriceBand = 'cheap' | 'medium' | 'expensive'

export interface PriceComparison {
  band: PriceBand | null
  /** 0–100 along дёшево → дорого. Null when the sample is too small. */
  position: number | null
  line: string
}

export interface CatalogPricePoint {
  venueId: string
  regionId: string | null
  variant: string
  priceRub: number
  checkedAt?: string
}

export interface PublicPriceCard {
  slug: string
  title: string
  variant: string
  priceRub: number
  checkedAt: string
  sourceTitle: string
  sourceUrl: string | null
  icon: string
  /** Custom picture from the catalog row. Wins over the food sticker. */
  image: string | null
  /** Food sticker when the slug has one and `image` is empty. */
  sticker: FoodStickerSlug | null
  href: string
  comparison: PriceComparison
}

/** Rendered width of a food sticker on a price card, in CSS px. `sizes` matches. */
export const PRICE_STICKER_WIDTH = 56

export interface SharedPriceSource {
  title: string
  url: string | null
  when: string
}

/**
 * Tabler keys for the live catalog. A custom picture (`price_items.image`,
 * then `PRICE_ITEM_IMAGES`) wins. Otherwise a slug in `FOOD_STICKERS` uses
 * that sticker. This icon is the last resort, before `PRICE_CATEGORY_ICONS`.
 */
export const PRICE_ITEM_ICONS: Record<string, string> = {
  'latte': 'mug',
  'raf': 'glass',
  'espresso': 'cup',
  'pepperoni': 'pizza',
  'carbonara': 'meat',
  'shawarma': 'grill',
  'pelmeni': 'dumpling',
  'bliny': 'flame',
  'tom-yum': 'soup',
  'ramen': 'bowl-chopsticks',
  'salmon-steak': 'fish',
  'draniki': 'flame',
  'klopsy': 'meat',
  'mors': 'glass',
  'lemonade': 'lemon',
  'mulled-wine': 'glass-full',
  'croissant': 'baguette',
  'cheesecake': 'cake',
  'syrniki': 'cheese',
  'tea-lemon': 'lemon',
  'orange-juice': 'glass',
  'beer': 'beer',
  'margherita': 'pizza',
  'burger': 'burger',
  'philadelphia': 'fish',
  'caesar': 'salad',
  'borscht': 'soup',
  'ukha': 'soup',
  'smoked-fish': 'fish',
  'business-lunch': 'tools-kitchen-2',
  'americano': 'cup',
  'cappuccino': 'coffee',
}

/** Used when a slug has no icon of its own. */
export const PRICE_CATEGORY_ICONS: Record<string, string> = {
  'coffee': 'coffee',
  'bakery': 'bread',
  'dessert': 'cake',
  'breakfast': 'egg',
  'tea': 'mug',
  'drinks': 'glass',
  'beer': 'beer',
  'pizza': 'pizza',
  'burger': 'burger',
  'street-food': 'grill',
  'sushi': 'fish',
  'salad': 'salad',
  'soup': 'soup',
  'pasta': 'meat',
  'main': 'tools-kitchen-2',
  'fish': 'fish',
  'lunch': 'tools-kitchen-2',
}

/**
 * Optional picture per catalog slug, used when the row has no `image`.
 * A site path or an https URL. Empty means the food sticker, when the slug
 * has one, otherwise the line icon.
 */
export const PRICE_ITEM_IMAGES: Partial<Record<string, string>> = {}

/** Genitive town names for «мест Светлогорска». Unknown slugs stay «региона». */
const OF_TOWN: Record<string, string> = {
  kaliningrad: 'Калининграда',
  svetlogorsk: 'Светлогорска',
  zelenogradsk: 'Зеленоградска',
  yantarnyy: 'Янтарного',
  baltiysk: 'Балтийска',
  sovetsk: 'Советска',
  pionerskiy: 'Пионерского',
  chernyakhovsk: 'Черняховска',
  gusev: 'Гусева',
  gvardeysk: 'Гвардейска',
  guryevsk: 'Гурьевска',
  bagrationovsk: 'Багратионовска',
  mamonovo: 'Мамоново',
  neman: 'Немана',
  polessk: 'Полесска',
  pravdinsk: 'Правдинска',
}

const SCALE_LABEL: Record<PriceBand, string> = {
  cheap: 'Дешевле медианы по региону',
  medium: 'Около медианы по региону',
  expensive: 'Дороже медианы по региону',
}

export function priceItemIcon(slug: string, category: string) {
  return PRICE_ITEM_ICONS[slug] ?? PRICE_CATEGORY_ICONS[category] ?? 'price'
}

/** A picture the card may show: a site path or an https URL. Anything else is dropped. */
export function safePriceImage(value: string | null | undefined) {
  const text = value?.trim() ?? ''
  if (!text) {
    return null
  }
  const sitePath = text.startsWith('/') && !text.startsWith('//') && !text.includes('..')
  if (sitePath || text.startsWith('https://')) {
    return text
  }
  return null
}

/** Custom picture: the stored row, then `PRICE_ITEM_IMAGES`. Null when neither is set. */
export function priceItemImage(slug: string, stored?: string | null) {
  return safePriceImage(stored) ?? safePriceImage(PRICE_ITEM_IMAGES[slug] ?? null)
}

/** Food sticker when the catalog has one and no custom picture is set. */
export function priceItemSticker(slug: string, stored?: string | null): FoodStickerSlug | null {
  if (priceItemImage(slug, stored)) {
    return null
  }
  return isFoodStickerSlug(slug) ? slug : null
}

export function priceItemPath(slug: string, regionSlug?: string | null) {
  const base = `/ceny/${slug}`
  return regionSlug ? `${base}/${regionSlug}` : base
}

export function ofTown(slug: string | null | undefined) {
  if (!slug) {
    return 'региона'
  }
  return OF_TOWN[slug] ?? 'региона'
}

export function priceScaleLabel(band: PriceBand) {
  return SCALE_LABEL[band]
}

export function formatRub(value: number) {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`
}

export function formatPriceDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function isPriceIndexable(sampleSize: number) {
  return sampleSize >= PRICE_INDEX_MIN
}

/** One price per venue. Prefer `variant` when a venue has it, otherwise the cheapest. */
export function onePricePerVenue<T extends CatalogPricePoint>(rows: T[], variant?: string) {
  const byVenue = new Map<string, T>()
  for (const row of rows) {
    const current = byVenue.get(row.venueId)
    byVenue.set(row.venueId, current ? preferRow(current, row, variant) : row)
  }
  return [...byVenue.values()]
}

function preferRow<T extends CatalogPricePoint>(current: T, row: T, variant: string | undefined) {
  if (variant) {
    const rowHit = row.variant === variant
    const currentHit = current.variant === variant
    if (rowHit !== currentHit) {
      return rowHit ? row : current
    }
  }
  return row.priceRub < current.priceRub ? row : current
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? 0
  }
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

function bandFor(priceRub: number, mid: number): PriceBand {
  const ratio = priceRub / mid
  if (ratio < CHEAP_RATIO) {
    return 'cheap'
  }
  if (ratio > EXPENSIVE_RATIO) {
    return 'expensive'
  }
  return 'medium'
}

/** Marker on a track whose thirds are the cheap / medium / expensive bands. */
function positionFor(priceRub: number, mid: number) {
  const raw = (priceRub / mid - 0.7) / 0.6
  return Math.round(Math.min(0.96, Math.max(0.04, raw)) * 100)
}

export function compareVenuePrice(input: {
  venueId: string
  priceRub: number
  variant: string
  regionId: string | null
  place: string
  peers: CatalogPricePoint[]
}): PriceComparison {
  const inRegion = input.peers.filter((row) => (row.regionId ?? null) === (input.regionId ?? null))
  const others = onePricePerVenue(inRegion, input.variant).filter((row) => row.venueId !== input.venueId)
  const prices = [...others.map((row) => row.priceRub), input.priceRub]
  if (prices.length < PRICE_COMPARE_MIN) {
    return { band: null, position: null, line: PRICE_FEW_DATA }
  }
  const mid = median(prices)
  const band = bandFor(input.priceRub, mid)
  const higher = prices.filter((value) => value > input.priceRub).length
  const lower = prices.filter((value) => value < input.priceRub).length
  const rankFromTop = higher + 1
  let line: string
  if (band === 'expensive' && rankFromTop <= 3 && prices.length >= 4) {
    line = PRICE_TOP
  } else if (higher > lower) {
    line = `дешевле, чем в ${higher} из ${prices.length} мест ${input.place}`
  } else if (lower > higher) {
    line = `дороже, чем в ${lower} из ${prices.length} мест ${input.place}`
  } else {
    line = `как в других местах ${input.place}`
  }
  return { band, position: positionFor(input.priceRub, mid), line }
}

export function priceBlockSummary(bands: Array<PriceBand | null>) {
  const known = bands.filter((band): band is PriceBand => band != null)
  if (!known.length) {
    return null
  }
  const cheap = known.filter((band) => band === 'cheap').length
  const expensive = known.filter((band) => band === 'expensive').length
  if (cheap > expensive) {
    return 'Цены ниже среднего по региону'
  }
  if (expensive > cheap) {
    return 'Цены выше среднего по региону'
  }
  return 'Цены около среднего по региону'
}

export function sharedPriceSource(rows: Array<{ sourceTitle: string, sourceUrl: string | null, checkedAt: string }>): SharedPriceSource | null {
  const first = rows[0]
  if (!first) {
    return null
  }
  const url = first.sourceUrl || null
  const same = rows.every((row) => row.sourceTitle === first.sourceTitle && (row.sourceUrl || null) === url)
  if (!same) {
    return null
  }
  const dates = [...new Set(rows.map((row) => row.checkedAt.slice(0, 10)))].sort()
  const when = dates.length > 1
    ? `проверено с ${formatPriceDate(dates[0] ?? first.checkedAt)} по ${formatPriceDate(dates[dates.length - 1] ?? first.checkedAt)}`
    : formatPriceDate(dates[0] ?? first.checkedAt)
  return { title: first.sourceTitle, url, when }
}

function listingHref(slug: string, regionSlug: string | null, regionId: string | null, peers: CatalogPricePoint[]) {
  const inRegion = regionId
    ? onePricePerVenue(peers.filter((row) => row.regionId === regionId))
    : []
  if (regionSlug && inRegion.length) {
    return priceItemPath(slug, regionSlug)
  }
  if (onePricePerVenue(peers).length) {
    return priceItemPath(slug)
  }
  return ''
}

export function buildPublicPrices(input: {
  venueId: string
  regionId: string | null
  regionSlug: string | null
  rows: Array<{
    item: string
    title: string
    category: string
    variant: string
    priceRub: number
    checkedAt: string
    sourceTitle: string
    sourceUrl: string | null
    image?: string | null
  }>
  peersByItem: Record<string, CatalogPricePoint[]>
}): PublicPriceCard[] {
  const place = ofTown(input.regionSlug)
  return input.rows.map((row) => {
    const peers = input.peersByItem[row.item] ?? []
    return {
      slug: row.item,
      title: row.title,
      variant: row.variant,
      priceRub: row.priceRub,
      checkedAt: row.checkedAt,
      sourceTitle: row.sourceTitle,
      sourceUrl: row.sourceUrl,
      icon: priceItemIcon(row.item, row.category),
      image: priceItemImage(row.item, row.image),
      sticker: priceItemSticker(row.item, row.image),
      href: listingHref(row.item, input.regionSlug, input.regionId, peers),
      comparison: compareVenuePrice({
        venueId: input.venueId,
        priceRub: row.priceRub,
        variant: row.variant,
        regionId: input.regionId,
        place,
        peers,
      }),
    }
  })
}

export function priceListingMeta(input: {
  title: string
  slug: string
  regionSlug: string | null
  regionName: string
  count: number
}) {
  const known = input.regionSlug ? inTown(input.regionSlug, input.regionName) : ''
  const h1 = known.startsWith('в ')
    ? `${input.title} ${known}`
    : input.regionSlug && input.regionName
      ? `${input.title}: ${input.regionName}`
      : input.title
  const scope = known.startsWith('в ') ? known : 'в области'
  const withIntent = `${h1}: цены`
  return {
    h1,
    path: priceItemPath(input.slug, input.regionSlug),
    description: `${input.title} ${scope}: свежие цены от более низких к более высоким. Для сравнения, не полное меню.`,
    seoTitle: pageTitle(withIntent).length <= 70 ? withIntent : h1,
    noindex: !isPriceIndexable(input.count),
  }
}

/** Sitemap locs for listings that already have one price per venue. */
export function indexablePriceLocs(items: Array<{
  slug: string
  points: Array<{ regionSlug: string | null, checkedAt: string }>
}>) {
  const locs: Array<{ loc: string, lastmod: string | null }> = []
  for (const item of items) {
    const push = (loc: string, points: Array<{ checkedAt: string }>) => {
      if (!isPriceIndexable(points.length)) {
        return
      }
      const lastmod = points.map((point) => point.checkedAt).sort().at(-1) ?? null
      locs.push({ loc, lastmod })
    }
    push(priceItemPath(item.slug), item.points)
    const byRegion = new Map<string, Array<{ checkedAt: string }>>()
    for (const point of item.points) {
      if (!point.regionSlug) {
        continue
      }
      const list = byRegion.get(point.regionSlug) ?? []
      list.push(point)
      byRegion.set(point.regionSlug, list)
    }
    for (const [regionSlug, points] of byRegion) {
      push(priceItemPath(item.slug, regionSlug), points)
    }
  }
  return locs
}
