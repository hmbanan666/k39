import type { FoodStickerSlug } from './food-stickers'
import { inTown } from './eat-now'
import { isFoodStickerSlug } from './food-stickers'
import { pageTitle } from './seo'

/**
 * «Ориентиры цен» (docs/venue-modules.md).
 * Comparison is pure: the server loads `db.prices.forItem` (published venues
 * only, one fresh price each) and calls these helpers, so the HTML already
 * contains the conclusion.
 */

/**
 * Below this many venues in the region (this one included) the card does not
 * rank the price. The popup still shows the town median, range, and count.
 */
export const PRICE_COMPARE_MIN = 3

/** A venue band needs at least this many of its own prices that have a town comparison. */
export const PRICE_BAND_MIN = 3

/** A /ceny listing stays noindex until about this many published venues have a price. */
export const PRICE_INDEX_MIN = 5

const CHEAP_RATIO = 0.9
const EXPENSIVE_RATIO = 1.1

export type PriceBand = 'cheap' | 'medium' | 'expensive'

/** Town sample behind one card. This venue is included. */
export interface PriceTownFacts {
  medianRub: number
  minRub: number
  maxRub: number
  /** Published venues in the sample. */
  places: number
  /** Heading, for example «В Светлогорске». */
  where: string
}

export interface PriceComparison {
  band: PriceBand | null
  /** 0–100 along дёшево → дорого. Null when the sample is too small. */
  position: number | null
  /** Sentence-case verdict. The town figures live on `town`, not in this line. */
  line: string
  /** Accessible name of the scale. Empty when there is no band. */
  scaleLabel: string
  town: PriceTownFacts
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

/**
 * The one source line under the grid. Each card still carries its own source
 * for schema.org and the stored rows.
 */
export interface SharedPriceSource {
  title: string
  url: string | null
  /** Latest check day of the prices that use this source, YYYY-MM-DD. */
  date: string
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

/**
 * Town name cases for price comparison. `of` is genitive («мест Светлогорска»).
 * `by` is dative («по Светлогорску»). The prepositional («в Светлогорске») is
 * `inTown`. Unknown slugs stay «региона» and «региону».
 */
const TOWN: Record<string, { of: string, by: string }> = {
  kaliningrad: { of: 'Калининграда', by: 'Калининграду' },
  svetlogorsk: { of: 'Светлогорска', by: 'Светлогорску' },
  zelenogradsk: { of: 'Зеленоградска', by: 'Зеленоградску' },
  yantarnyy: { of: 'Янтарного', by: 'Янтарному' },
  baltiysk: { of: 'Балтийска', by: 'Балтийску' },
  sovetsk: { of: 'Советска', by: 'Советску' },
  pionerskiy: { of: 'Пионерского', by: 'Пионерскому' },
  chernyakhovsk: { of: 'Черняховска', by: 'Черняховску' },
  gusev: { of: 'Гусева', by: 'Гусеву' },
  gvardeysk: { of: 'Гвардейска', by: 'Гвардейску' },
  guryevsk: { of: 'Гурьевска', by: 'Гурьевску' },
  bagrationovsk: { of: 'Багратионовска', by: 'Багратионовску' },
  mamonovo: { of: 'Мамоново', by: 'Мамоново' },
  neman: { of: 'Немана', by: 'Неману' },
  polessk: { of: 'Полесска', by: 'Полесску' },
  pravdinsk: { of: 'Правдинска', by: 'Правдинску' },
}

const SCALE_LEAD: Record<PriceBand, string> = {
  cheap: 'Дешевле медианы по',
  medium: 'Около медианы по',
  expensive: 'Дороже медианы по',
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
  return TOWN[slug]?.of ?? 'региона'
}

/** Dative for «по Светлогорску». Unknown slugs stay «региону». */
export function byTown(slug: string | null | undefined) {
  if (!slug) {
    return 'региону'
  }
  return TOWN[slug]?.by ?? 'региону'
}

/** Prepositional phrase for «в Светлогорске». Unknown towns stay «в регионе». */
export function inPlace(slug: string | null | undefined) {
  if (!slug) {
    return 'в регионе'
  }
  const phrase = inTown(slug, '')
  return phrase.startsWith('в ') ? phrase : 'в регионе'
}

/** One line under «Ориентиры цен». Town is genitive: «заведениями Светлогорска». */
export function priceCompareLead(slug: string | null | undefined) {
  return `Сравниваем с другими заведениями ${ofTown(slug)}`
}

/**
 * Nominative count for a parenthetical: «1 место», «2 места», «5 мест», «21 место».
 */
export function placesLabel(count: number) {
  const n = Math.abs(Math.trunc(count))
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) {
    return `${n} место`
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} места`
  }
  return `${n} мест`
}

/**
 * Noun after «из». «из 3 мест», «из 21 места»: 1, 21, 31… take genitive singular,
 * every other count takes genitive plural.
 */
export function placesOutOf(count: number) {
  const n = Math.abs(Math.trunc(count))
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) {
    return `${n} места`
  }
  return `${n} мест`
}

/** Accessible name of the scale. `by` is the dative town («Светлогорску»). */
export function priceScaleLabel(band: PriceBand, by = 'региону') {
  return `${SCALE_LEAD[band]} ${by}`
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

export function formatTownRange(town: PriceTownFacts) {
  return formatPriceSpan(town.minRub, town.maxRub)
}

function formatPriceSpan(min: number, max: number) {
  if (min === max) {
    return formatRub(min)
  }
  const format = new Intl.NumberFormat('ru-RU')
  return `${format.format(min)}–${format.format(max)} ₽`
}

function sentenceCase(text: string) {
  if (!text) {
    return text
  }
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function townFacts(prices: number[], where: string): PriceTownFacts {
  return {
    medianRub: median(prices),
    minRub: Math.min(...prices),
    maxRub: Math.max(...prices),
    places: prices.length,
    where: sentenceCase(where),
  }
}

function unranked(line: string, prices: number[], where: string): PriceComparison {
  return { band: null, position: null, line, scaleLabel: '', town: townFacts(prices, where) }
}

/** A stored variant that names a real portion. Placeholders stay off the popup. */
export function knownPortion(variant: string | null | undefined) {
  const text = variant?.trim() ?? ''
  if (!text || /не указан/i.test(text)) {
    return null
  }
  return text
}

export function compareVenuePrice(input: {
  venueId: string
  priceRub: number
  variant: string
  regionId: string | null
  /** Genitive: «мест Светлогорска». */
  place: string
  /** Prepositional phrase: «в Светлогорске». */
  where: string
  /** Dative: «по Светлогорску». */
  by: string
  peers: CatalogPricePoint[]
}): PriceComparison {
  const inRegion = input.peers.filter((row) => (row.regionId ?? null) === (input.regionId ?? null))
  const others = onePricePerVenue(inRegion, input.variant).filter((row) => row.venueId !== input.venueId)
  const prices = [...others.map((row) => row.priceRub), input.priceRub]
  const town = townFacts(prices, input.where)
  if (others.length === 0) {
    return unranked('Пока единственная цена', prices, input.where)
  }
  if (prices.length < PRICE_COMPARE_MIN) {
    return unranked('Пока мало данных для сравнения', prices, input.where)
  }
  const mid = town.medianRub
  const band = bandFor(input.priceRub, mid)
  const higher = prices.filter((value) => value > input.priceRub).length
  const lower = prices.filter((value) => value < input.priceRub).length
  const rankFromTop = higher + 1
  const outOf = placesOutOf(prices.length)
  let line: string
  if (band === 'expensive' && rankFromTop <= 3 && prices.length >= 4) {
    line = `Топ-3 по цене ${input.where}`
  } else if (higher > lower) {
    line = `Дешевле, чем в ${higher} из ${outOf} ${input.place}`
  } else if (lower > higher) {
    line = `Дороже, чем в ${lower} из ${outOf} ${input.place}`
  } else {
    line = `Как в других местах ${input.place}`
  }
  return { band, position: positionFor(input.priceRub, mid), line, scaleLabel: priceScaleLabel(band, input.by), town }
}

export interface PriceSummary {
  /** Short badge: «ниже среднего». */
  text: string
  /** Full name: «Цены ниже среднего по Светлогорску». */
  label: string
}

/** Stored town comparison. Distinct from the editorial 1–4 `priceLevel`. */
export type StoredPriceBand = 'low' | 'mid' | 'high'

/**
 * The badge decision. `basis` is how many of this venue's prices had a town
 * comparison. Below `PRICE_BAND_MIN` the level stays null, so the badge hides.
 */
export function priceBandFromBands(bands: Array<PriceBand | null>): { level: StoredPriceBand | null, basis: number } {
  const known = bands.filter((band): band is PriceBand => band != null)
  if (known.length < PRICE_BAND_MIN) {
    return { level: null, basis: known.length }
  }
  const cheap = known.filter((band) => band === 'cheap').length
  const expensive = known.filter((band) => band === 'expensive').length
  let level: StoredPriceBand = 'mid'
  if (cheap > expensive) {
    level = 'low'
  } else if (expensive > cheap) {
    level = 'high'
  }
  return { level, basis: known.length }
}

/** Badge copy for a stored band. Null hides the badge. */
export function priceBadgeFromBand(level: StoredPriceBand | null | undefined, regionSlug?: string | null): PriceSummary | null {
  if (!level) {
    return null
  }
  let word = 'около'
  if (level === 'low') {
    word = 'ниже'
  } else if (level === 'high') {
    word = 'выше'
  }
  return {
    text: `${word} среднего`,
    label: `Цены ${word} среднего по ${byTown(regionSlug)}`,
  }
}

export function priceBlockSummary(bands: Array<PriceBand | null>, regionSlug?: string | null): PriceSummary | null {
  return priceBadgeFromBand(priceBandFromBands(bands).level, regionSlug)
}

/**
 * One menu link for the footnote. The most common URL wins. A tie goes to the
 * URL whose newest price is later. Rows with no URL count only when nothing
 * has a URL. The date is the latest day of the prices that use that source.
 */
export function sharedPriceSource(rows: Array<{ sourceTitle: string, sourceUrl: string | null, checkedAt: string }>): SharedPriceSource | null {
  if (!rows.length) {
    return null
  }
  const withUrl = rows.filter((row) => row.sourceUrl?.trim())
  const pool = withUrl.length ? withUrl : rows
  const buckets = new Map<string, { title: string, url: string | null, count: number, latest: string }>()
  for (const row of pool) {
    const url = row.sourceUrl?.trim() || null
    const key = url ?? ''
    const day = row.checkedAt.slice(0, 10)
    const current = buckets.get(key)
    if (!current) {
      buckets.set(key, { title: row.sourceTitle, url, count: 1, latest: day })
      continue
    }
    current.count += 1
    if (day >= current.latest) {
      current.latest = day
      current.title = row.sourceTitle
    }
  }
  const winner = [...buckets.values()].sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest))[0]
  if (!winner) {
    return null
  }
  return { title: winner.title, url: winner.url, date: winner.latest }
}

/**
 * First tap on a coarse pointer reveals the comparison. A second tap, a
 * keyboard activation, or any click with a fine pointer follows the card link.
 */
export function priceCardTap(input: { finePointer: boolean, keyboard: boolean, open: boolean }) {
  if (input.finePointer || input.keyboard || input.open) {
    return 'follow' as const
  }
  return 'open' as const
}

/** schema.org list of the benchmark prices. Sources stay here when the cards hide them. */
export function priceListNode(items: PublicPriceCard[], title: string) {
  if (!items.length) {
    return null
  }
  return {
    '@type': 'ItemList',
    'name': title,
    'itemListElement': items.map((item, index) => {
      const offer: Record<string, unknown> = {
        '@type': 'Offer',
        'name': item.variant ? `${item.title}, ${item.variant}` : item.title,
        'price': item.priceRub,
        'priceCurrency': 'RUB',
        'description': item.sourceTitle,
        'validFrom': item.checkedAt.slice(0, 10),
      }
      if (item.sourceUrl && /^https?:\/\//.test(item.sourceUrl)) {
        offer.url = item.sourceUrl
      }
      return { '@type': 'ListItem', 'position': index + 1, 'item': offer }
    }),
  }
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

function withVenueFrom(href: string, venueSlug: string | null | undefined) {
  if (!href || !venueSlug) {
    return href
  }
  return `${href}?from=${encodeURIComponent(venueSlug)}`
}

export function buildPublicPrices(input: {
  venueId: string
  venueSlug?: string | null
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
  const where = inPlace(input.regionSlug)
  const by = byTown(input.regionSlug)
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
      href: withVenueFrom(listingHref(row.item, input.regionSlug, input.regionId, peers), input.venueSlug),
      comparison: compareVenuePrice({
        venueId: input.venueId,
        priceRub: row.priceRub,
        variant: row.variant,
        regionId: input.regionId,
        place,
        where,
        by,
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
