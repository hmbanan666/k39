import { z } from 'zod'

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
      name: short,
      priceRub: z.number().int().min(0).nullable().optional(),
      note: z.string().trim().max(200).nullable().optional(),
    })).min(1).max(8),
    note: z.string().trim().max(300).optional(),
  }),
  z.object({
    type: z.literal('audience'),
    title: title.optional(),
    items: z.array(z.object({ who: short, text: z.string().trim().min(1).max(400) })).min(1).max(5),
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
  'practical': 'Практично',
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
    | { type: 'dishes', id: string, title: string, items: { name: string, priceRub: number | null, note: string | null }[], note: string | null }
    | { type: 'audience', id: string, title: string, items: { who: string, html: string }[] }
    | { type: 'practical', id: string, title: string, items: { key: string, label: string, value: string }[] }
    | { type: 'best-time', id: string, title: string, html: string }
    | { type: 'tips', id: string, title: string, items: string[] }
    | { type: 'faq', id: string, title: string, items: { question: string, html: string }[] }
    | { type: 'prices', id: string, title: string, items: PublicVenuePrice[] }

export interface PublicVenuePrice {
  title: string
  variant: string
  priceRub: number
  checkedAt: string
  sourceTitle: string
  sourceUrl: string | null
}

export interface PublicVenueModules {
  /** Content modules in stored order, without how-to-get. */
  blocks: PublicVenueModule[]
  /** how-to-get text, rendered inside the directions block. */
  howToGetHtml: string | null
}

/** Validates and renders stored modules. Invalid or empty input yields null. */
export function toPublicVenueModules(stored: unknown, render: (markdown: string) => string, prices: PublicVenuePrice[] = []): PublicVenueModules | null {
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
        blocks.push({ type: 'dishes', id: idFor('dishes'), title: heading, items: module.items.map((item) => ({ name: item.name, priceRub: item.priceRub ?? null, note: item.note ?? null })), note: module.note ?? null })
        break
      case 'audience':
        blocks.push({ type: 'audience', id: idFor('audience'), title: heading, items: module.items.map((item) => ({ who: item.who, html: render(item.text) })) })
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
        // Hidden without verified prices.
        if (prices.length) {
          blocks.push({ type: 'prices', id: idFor('prices'), title: heading, items: prices })
        }
        break
      case 'faq':
        blocks.push({ type: 'faq', id: idFor('faq'), title: heading, items: module.items.map((item) => ({ question: item.question, html: render(item.answer) })) })
        break
    }
  }
  return blocks.length || howToGetHtml ? { blocks, howToGetHtml } : null
}
