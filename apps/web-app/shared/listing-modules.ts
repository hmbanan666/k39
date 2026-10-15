import type { PublicMedia } from './media'
import type { ScheduleRecord } from './schedule'
import { z } from 'zod'

// Listing modules for /zavedeniya town and kind pages. Same idea as venue
// modules: an ordered jsonb list, each block renders only when it has data.
// See docs/venue-modules.md.

const markdown = z.string().trim().min(1).max(4000)
const short = z.string().trim().min(1).max(160)
const title = z.string().trim().min(1).max(120)
const placeSlug = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80)

/** Icons that already exist in shared/icons.ts. */
export const SITUATION_ICONS = ['kids', 'beaches', 'hours', 'coffee', 'family', 'group'] as const
export type SituationIcon = typeof SITUATION_ICONS[number]

export const SITUATION_ICON_KEYS: Record<SituationIcon, string> = {
  kids: 'kids',
  beaches: 'beaches',
  hours: 'hours',
  coffee: 'coffee',
  family: 'aud-family',
  group: 'aud-group',
}

const listingModuleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('choose'),
    title: title.optional(),
    text: markdown,
  }),
  z.object({
    type: z.literal('situation'),
    title: title.optional(),
    items: z.array(z.object({
      label: z.string().trim().min(1).max(80),
      note: z.string().trim().max(300).optional(),
      placeSlug,
      icon: z.enum(SITUATION_ICONS).optional(),
    })).min(1).max(8),
  }),
  z.object({
    type: z.literal('areas'),
    title: title.optional(),
    items: z.array(z.object({
      name: short,
      text: markdown,
    })).min(1).max(8),
  }),
  z.object({
    type: z.literal('season'),
    title: title.optional(),
    text: markdown.optional(),
    items: z.array(z.object({
      when: short,
      text: markdown,
    })).max(6).optional(),
  }),
  z.object({
    type: z.literal('faq'),
    title: title.optional(),
    items: z.array(z.object({
      question: short,
      answer: z.string().trim().min(1).max(800),
    })).min(1).max(8),
  }),
])

export const listingModulesSchema = z.array(listingModuleSchema).max(8).superRefine((modules, ctx) => {
  for (const unique of ['choose', 'situation', 'areas', 'season', 'faq'] as const) {
    if (modules.filter((item) => item.type === unique).length > 1) {
      ctx.addIssue({ code: 'custom', message: `At most one ${unique} module` })
    }
  }
  for (const [index, module] of modules.entries()) {
    if (module.type === 'season' && !module.text && !(module.items && module.items.length)) {
      ctx.addIssue({ code: 'custom', message: 'Season module needs text or items', path: [index] })
    }
  }
})

export type ListingModule = z.infer<typeof listingModuleSchema>

export const LISTING_MODULE_TITLES: Record<ListingModule['type'], string> = {
  choose: 'Как выбрать',
  situation: 'По ситуации',
  areas: 'Районы и улицы',
  season: 'Сезонность',
  faq: 'Вопросы',
}

export const LISTING_MODULE_IDS: Record<ListingModule['type'], string> = {
  choose: 'kak-vybrat',
  situation: 'po-situacii',
  areas: 'rajony',
  season: 'sezon',
  faq: 'voprosy',
}

/** A venue card inside «По ситуации». The same fields VenueCard already takes. */
export interface ListingVenueCard {
  href: string
  slug: string
  name: string
  kindLabel: string
  media: PublicMedia | null
  schedule: ScheduleRecord | null
  stale: boolean
  meta: string
}

export type PublicListingModule
  = | { type: 'choose', id: string, title: string, html: string }
    | { type: 'situation', id: string, title: string, items: { label: string, note: string | null, icon: SituationIcon | null, card: ListingVenueCard }[] }
    | { type: 'areas', id: string, title: string, items: { name: string, html: string }[] }
    | { type: 'season', id: string, title: string, html: string | null, items: { when: string, html: string }[] }
    | { type: 'faq', id: string, title: string, items: { question: string, html: string }[] }

/** Rendered modules before venue cards are attached. Situation items still name a slug. */
export type DraftListingModule
  = | Exclude<PublicListingModule, { type: 'situation' }>
    | { type: 'situation', id: string, title: string, items: { label: string, note: string | null, icon: SituationIcon | null, placeSlug: string }[] }

/** Validates and renders stored modules. Invalid or empty input yields none. */
export function toPublicListingModules(stored: unknown, render: (markdown: string) => string): DraftListingModule[] {
  const parsed = listingModulesSchema.safeParse(stored ?? [])
  if (!parsed.success || !parsed.data.length) {
    return []
  }
  const blocks: DraftListingModule[] = []
  for (const module of parsed.data) {
    const heading = ('title' in module && module.title) || LISTING_MODULE_TITLES[module.type]
    const id = LISTING_MODULE_IDS[module.type]
    switch (module.type) {
      case 'choose':
        blocks.push({ type: 'choose', id, title: heading, html: render(module.text) })
        break
      case 'situation':
        blocks.push({
          type: 'situation',
          id,
          title: heading,
          items: module.items.map((item) => ({
            label: item.label,
            note: item.note ?? null,
            icon: item.icon ?? null,
            placeSlug: item.placeSlug,
          })),
        })
        break
      case 'areas':
        blocks.push({
          type: 'areas',
          id,
          title: heading,
          items: module.items.map((item) => ({ name: item.name, html: render(item.text) })),
        })
        break
      case 'season':
        blocks.push({
          type: 'season',
          id,
          title: heading,
          html: module.text ? render(module.text) : null,
          items: (module.items ?? []).map((item) => ({ when: item.when, html: render(item.text) })),
        })
        break
      case 'faq':
        blocks.push({
          type: 'faq',
          id,
          title: heading,
          items: module.items.map((item) => ({ question: item.question, html: render(item.answer) })),
        })
        break
    }
  }
  return blocks
}

/** Drops a situation pick whose venue is missing, and the block when none remain. */
export function attachSituationCards(blocks: DraftListingModule[], cards: ReadonlyMap<string, ListingVenueCard>): PublicListingModule[] {
  const ready: PublicListingModule[] = []
  for (const block of blocks) {
    if (block.type !== 'situation') {
      ready.push(block)
      continue
    }
    const items = block.items.flatMap((item) => {
      const card = cards.get(item.placeSlug)
      return card ? [{ label: item.label, note: item.note, icon: item.icon, card }] : []
    })
    if (items.length) {
      ready.push({ type: 'situation', id: block.id, title: block.title, items })
    }
  }
  return ready
}
