import type { PublicMedia } from './media'
import type { PublicPriceCard, SharedPriceSource } from './price-compare'
import { createId } from '@paralleldrive/cuid2'
import { z } from 'zod'
import { priceBlockSummary, priceCompareLead, sharedPriceSource } from './price-compare'

/** Audience card icons (Tabler line icons via shared/icons.ts `aud-*`). Default: `group`. */
export const AUDIENCE_ICONS = ['group', 'family', 'kids', 'couple', 'solo', 'friends', 'beach', 'day-trip', 'tourist', 'local', 'pets', 'work'] as const
export type AudienceIcon = typeof AUDIENCE_ICONS[number]

/** Curated «Что заказать» list. Not a full menu. */
export const DISH_SHOWCASE_MAX = 8

/**
 * A dish price older than this is hidden, the same window as
 * `PRICE_FRESH_DAYS` for «Ориентиры цен».
 */
export const DISH_PRICE_FRESH_DAYS = 365

const DISH_ID = /^[\w-]{8,40}$/

export function isDishId(value: string) {
  return DISH_ID.test(value)
}

// Venue page modules (docs/venue-modules.md). Stored in venues.modules,
// edited through venue_update. Each module renders only with data.

const markdown = z.string().trim().min(1).max(3000)
const short = z.string().trim().min(1).max(160)
const title = z.string().trim().min(1).max(120)

export const PRACTICAL_KEYS = ['takeaway', 'terrace', 'kids', 'payment', 'wifi', 'dogs', 'parking', 'other'] as const

export const venueModuleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    title: title.optional(),
    variant: z.enum(['lead', 'plain']).default('plain'),
    text: markdown,
  }),
  z.object({
    type: z.literal('dishes'),
    title: title.optional(),
    items: z.array(z.object({
      /** Stable across edits and reordering. Not a review key. Assigned on write when missing. */
      id: z.string().trim().regex(DISH_ID).optional(),
      name: short,
      /** Short text. `note` is the previous field and is accepted on input. */
      description: z.string().trim().max(200).nullable().optional(),
      note: z.string().trim().max(200).nullable().optional(),
      priceRub: z.number().int().min(0).nullable().optional(),
      /** media.id already attached to this venue. */
      mediaId: z.string().trim().min(1).max(40).nullable().optional(),
      /** When the price was last set or confirmed. ISO timestamp. */
      updatedAt: z.string().trim().min(10).max(40).optional(),
      /** Owner confirms the same price is still right. Not stored. */
      refreshPrice: z.boolean().optional(),
    })).min(1).max(DISH_SHOWCASE_MAX),
    note: z.string().trim().max(300).optional(),
  }),
  z.object({
    type: z.literal('audience'),
    title: title.optional(),
    items: z.array(z.object({ who: short, icon: z.enum(AUDIENCE_ICONS).optional(), text: z.string().trim().min(1).max(400) })).min(1).max(5),
  }),
  z.object({
    type: z.literal('practical'),
    title: title.optional(),
    items: z.array(z.object({ key: z.enum(PRACTICAL_KEYS), label: short, value: z.string().trim().min(1).max(300) })).min(1).max(10),
  }),
  z.object({
    type: z.literal('best-time'),
    title: title.optional(),
    text: markdown,
  }),
  z.object({
    type: z.literal('how-to-get'),
    text: markdown,
  }),
  z.object({
    type: z.literal('tips'),
    title: title.optional(),
    items: z.array(z.string().trim().min(1).max(400)).min(1).max(8),
  }),
  z.object({
    /** «Ориентиры цен»: rows come from venue_prices, not from the module. */
    type: z.literal('prices'),
    title: title.optional(),
  }),
  z.object({
    type: z.literal('faq'),
    title: title.optional(),
    items: z.array(z.object({ question: short, answer: z.string().trim().min(1).max(800) })).min(1).max(8),
  }),
])

export const venueModulesSchema = z.array(venueModuleSchema).max(16).superRefine((modules, ctx) => {
  for (const unique of ['prices', 'dishes', 'audience', 'practical', 'best-time', 'how-to-get', 'faq'] as const) {
    if (modules.filter((item) => item.type === unique).length > 1) {
      ctx.addIssue({ code: 'custom', message: `At most one ${unique} module` })
    }
  }
})

export type VenueModule = z.infer<typeof venueModuleSchema>

export const VENUE_MODULE_TITLES: Record<VenueModule['type'], string> = {
  'text': 'О месте',
  'dishes': 'Что заказать',
  'audience': 'Кому подойдёт',
  'practical': 'Полезно знать',
  'best-time': 'Когда лучше прийти',
  'how-to-get': 'Как добраться',
  'tips': 'Советы',
  'prices': 'Ориентиры цен',
  'faq': 'Вопросы',
}

/** Latin anchors for the reader contents. */
export const VENUE_MODULE_IDS: Record<VenueModule['type'], string> = {
  'text': 'o-meste',
  'dishes': 'chto-zakazat',
  'audience': 'komu-podoydet',
  'practical': 'praktichno',
  'best-time': 'kogda-prijti',
  'how-to-get': 'kak-dobratsya',
  'tips': 'sovety',
  'prices': 'tseny',
  'faq': 'voprosy',
}

export type PublicVenueModule
  = | { type: 'text', id: string, title: string, variant: 'lead' | 'plain', html: string }
    | { type: 'dishes', id: string, title: string, items: PublicDish[], note: string | null }
    | { type: 'audience', id: string, title: string, items: { who: string, icon: AudienceIcon, html: string }[] }
    | { type: 'practical', id: string, title: string, items: { key: string, label: string, value: string }[] }
    | { type: 'best-time', id: string, title: string, html: string }
    | { type: 'tips', id: string, title: string, items: string[] }
    | { type: 'faq', id: string, title: string, items: { question: string, html: string }[] }
    | { type: 'prices', id: string, title: string, lead: string, items: PublicPriceCard[], summary: string | null, source: SharedPriceSource | null }

export interface PublicDish {
  /** Persisted id, or a display key when a reverted snapshot has none yet. */
  id: string
  name: string
  description: string | null
  /** Null when the venue gave no price, or the price is older than a year. */
  priceRub: number | null
  media: PublicMedia | null
}

export type { PriceBand, PublicPriceCard, SharedPriceSource } from './price-compare'

export interface PublicVenueModules {
  /** Content modules in stored order, without how-to-get. */
  blocks: PublicVenueModule[]
  /** how-to-get text, rendered inside the directions block. */
  howToGetHtml: string | null
}

export interface VenueModuleView {
  now?: Date
  mediaById?: ReadonlyMap<string, PublicMedia>
  /** «Сравниваем с другими заведениями Светлогорска». */
  priceLead?: string
  /** Town slug for the price chip («по Светлогорску»). */
  regionSlug?: string | null
}

/** Validates and renders stored modules. Invalid or empty input yields null. */
export function toPublicVenueModules(stored: unknown, render: (markdown: string) => string, prices: PublicPriceCard[] = [], view: VenueModuleView = {}): PublicVenueModules | null {
  const parsed = venueModulesSchema.safeParse(stored)
  if (!parsed.success || !parsed.data.length) {
    return null
  }
  let howToGetHtml: string | null = null
  const blocks: PublicVenueModule[] = []
  const used = new Map<string, number>()
  const idFor = (type: VenueModule['type']) => {
    const count = (used.get(type) ?? 0) + 1
    used.set(type, count)
    return count === 1 ? VENUE_MODULE_IDS[type] : `${VENUE_MODULE_IDS[type]}-${count}`
  }
  for (const module of parsed.data) {
    const heading = ('title' in module && module.title) || VENUE_MODULE_TITLES[module.type]
    switch (module.type) {
      case 'how-to-get':
        howToGetHtml = render(module.text)
        break
      case 'text':
        blocks.push({ type: 'text', id: idFor('text'), title: heading, variant: module.variant, html: render(module.text) })
        break
      case 'dishes':
        blocks.push({
          type: 'dishes',
          id: idFor('dishes'),
          title: heading,
          items: module.items.map((item, index) => presentDish(item, index, view)),
          note: module.note ?? null,
        })
        break
      case 'audience':
        blocks.push({ type: 'audience', id: idFor('audience'), title: heading, items: module.items.map((item) => ({ who: item.who, icon: item.icon ?? 'group', html: render(item.text) })) })
        break
      case 'practical':
        blocks.push({ type: 'practical', id: idFor('practical'), title: heading, items: module.items })
        break
      case 'best-time':
        blocks.push({ type: 'best-time', id: idFor('best-time'), title: heading, html: render(module.text) })
        break
      case 'tips':
        blocks.push({ type: 'tips', id: idFor('tips'), title: heading, items: module.items })
        break
      case 'prices':
        // Hidden without verified prices. Comparison is already on each card.
        if (prices.length) {
          blocks.push({
            type: 'prices',
            id: idFor('prices'),
            title: heading,
            items: prices,
            lead: view.priceLead || priceCompareLead(null),
            summary: priceBlockSummary(prices.map((row) => row.comparison.band), view.regionSlug),
            source: sharedPriceSource(prices),
          })
        }
        break
      case 'faq':
        blocks.push({ type: 'faq', id: idFor('faq'), title: heading, items: module.items.map((item) => ({ question: item.question, html: render(item.answer) })) })
        break
    }
  }
  return blocks.length || howToGetHtml ? { blocks, howToGetHtml } : null
}

interface StoredDish {
  id?: string
  name?: string
  description?: string | null
  note?: string | null
  priceRub?: number | null
  mediaId?: string | null
  updatedAt?: string
  refreshPrice?: boolean
}

function dishText(item: { description?: string | null, note?: string | null }) {
  return (item.description ?? item.note ?? '').trim() || null
}

export function dishPriceIsFresh(updatedAt: string | null | undefined, now = new Date()) {
  if (!updatedAt) {
    return true
  }
  const day = updatedAt.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return true
  }
  const cutoff = new Date(now.getTime() - DISH_PRICE_FRESH_DAYS * 86_400_000).toISOString().slice(0, 10)
  return day >= cutoff
}

function readStoredDishes(stored: unknown): StoredDish[] {
  if (!Array.isArray(stored)) {
    return []
  }
  const items: StoredDish[] = []
  for (const module of stored) {
    if (!module || typeof module !== 'object') {
      continue
    }
    const row = module as { type?: string, items?: unknown }
    if (row.type !== 'dishes' || !Array.isArray(row.items)) {
      continue
    }
    for (const item of row.items) {
      if (item && typeof item === 'object') {
        items.push(item as StoredDish)
      }
    }
  }
  return items
}

function presentDish(item: StoredDish, index: number, view: VenueModuleView): PublicDish {
  const price = typeof item.priceRub === 'number' ? item.priceRub : null
  const mediaId = item.mediaId?.trim() || ''
  return {
    id: item.id && isDishId(item.id) ? item.id : `item-${index + 1}`,
    name: item.name?.trim() || '',
    description: dishText(item),
    priceRub: price != null && price > 0 && dishPriceIsFresh(item.updatedAt, view.now) ? price : null,
    media: mediaId ? view.mediaById?.get(mediaId) ?? null : null,
  }
}

/**
 * Gives every dish a stable id and a price date. An unchanged price keeps its
 * date, so editing the text does not make a year-old price look fresh.
 * `note` is copied into `description`. The module-level note stays.
 */
export function stampDishModules(modules: VenueModule[], previous: unknown, now = new Date()): VenueModule[] {
  const prior = new Map<string, StoredDish>()
  for (const item of readStoredDishes(previous)) {
    if (item.id && isDishId(item.id) && !prior.has(item.id)) {
      prior.set(item.id, item)
    }
  }
  const used = new Set<string>()
  return modules.map((module) => {
    if (module.type !== 'dishes') {
      return module
    }
    const items = module.items.map((item) => {
      const id = item.id && isDishId(item.id) && !used.has(item.id) ? item.id : createId()
      used.add(id)
      const priceRub = typeof item.priceRub === 'number' ? item.priceRub : null
      const before = prior.get(id)
      const priceSame = !!before && (before.priceRub ?? null) === priceRub
      const updatedAt = priceSame && !item.refreshPrice && before.updatedAt
        ? before.updatedAt
        : now.toISOString()
      return {
        id,
        name: item.name,
        description: dishText(item),
        priceRub,
        mediaId: item.mediaId?.trim() || null,
        updatedAt,
      }
    })
    return { ...module, items }
  })
}

export interface DishPhotoLink {
  id: string
  mediaId: string | null
}

export interface DishPhotoSlot {
  mediaId: string
  origin: string | null
}

/** Who may point a dish at a photo. An unchanged mediaId is always kept. */
export function dishPhotoProblem(
  items: DishPhotoLink[],
  previous: DishPhotoLink[],
  gallery: DishPhotoSlot[],
  actor: 'owner' | 'editorial',
): string | null {
  const prior = new Map(previous.map((item) => [item.id, item.mediaId]))
  const origins = new Map(gallery.map((row) => [row.mediaId, row.origin]))
  for (const item of items) {
    if (!item.mediaId) {
      continue
    }
    if (!origins.has(item.mediaId)) {
      return 'Фото блюда не найдено на странице заведения'
    }
    if (prior.get(item.id) === item.mediaId) {
      continue
    }
    const origin = origins.get(item.mediaId)
    if (actor === 'owner' && origin !== 'venue') {
      return 'Фото блюда загружается из кабинета и помечается как от заведения'
    }
    if (actor === 'editorial' && origin !== 'own' && origin !== 'commons') {
      return 'К блюду можно прикрепить только своё фото или снимок Commons'
    }
  }
  return null
}

export function dishLinks(stored: unknown): DishPhotoLink[] {
  return readStoredDishes(stored).flatMap((item) => {
    if (!item.id || !isDishId(item.id)) {
      return []
    }
    return [{ id: item.id, mediaId: item.mediaId?.trim() || null }]
  })
}

/** schema.org Menu for the showcase. Prices that the page hides are omitted. */
export function dishMenuNode(
  block: { title: string, items: PublicDish[] },
  options?: { menuUrl?: string | null, absolute?: (path: string) => string },
) {
  if (!block.items.length) {
    return null
  }
  const absolute = options?.absolute ?? ((path: string) => path)
  const hasMenuItem = block.items.map((item) => {
    const row: Record<string, unknown> = { '@type': 'MenuItem', 'name': item.name }
    if (item.description) {
      row.description = item.description
    }
    if (item.media?.src) {
      row.image = absolute(item.media.src)
    }
    if (item.priceRub) {
      row.offers = { '@type': 'Offer', 'price': item.priceRub, 'priceCurrency': 'RUB' }
    }
    return row
  })
  const menu: Record<string, unknown> = { '@type': 'Menu', 'name': block.title, 'hasMenuItem': hasMenuItem }
  const menuUrl = options?.menuUrl?.trim() || ''
  if (menuUrl.startsWith('http://') || menuUrl.startsWith('https://')) {
    menu.url = menuUrl
  }
  return menu
}
