import { z } from 'zod'

// Module-based pages (ADR 0023). A page is an ordered list of typed modules.
// The server renders every module in full; the picker only reorders cards
// and marks the ones that fit, it never removes content from the page.

/** Picker questions. Values are URL-safe latin slugs, labels are UI copy. */
export const PICKER_QUESTIONS = {
  interest: {
    param: 'i',
    label: 'Что интересно?',
    multiple: true,
    options: [
      { value: 'more', label: 'Море' },
      { value: 'istoriya', label: 'История и замки' },
      { value: 'priroda', label: 'Природа' },
      { value: 'eda', label: 'Еда' },
      { value: 'muzei', label: 'Музеи' },
      { value: 'yantar', label: 'Янтарь' },
      { value: 'arhitektura', label: 'Архитектура' },
    ],
  },
  company: {
    param: 'c',
    label: 'С кем?',
    multiple: false,
    options: [
      { value: 'vdvoem', label: 'Один или вдвоём' },
      { value: 'deti', label: 'С детьми' },
      { value: 'sobaka', label: 'С собакой' },
      { value: 'kompaniya', label: 'Компанией' },
    ],
  },
  transport: {
    param: 't',
    label: 'Как передвигаетесь?',
    multiple: false,
    options: [
      { value: 'mashina', label: 'На машине' },
      { value: 'bez-mashiny', label: 'Без машины' },
      { value: 'peshkom', label: 'Пешком по городу' },
    ],
  },
} as const

export type PickerQuestion = keyof typeof PICKER_QUESTIONS
export const PICKER_QUESTION_KEYS = Object.keys(PICKER_QUESTIONS) as PickerQuestion[]
export const PICKER_TAGS: string[] = PICKER_QUESTION_KEYS.flatMap((key) => PICKER_QUESTIONS[key].options.map((option) => option.value))
/** Query keys the picker owns. Robots treat them as clean params. */
export const PICKER_PARAMS: string[] = PICKER_QUESTION_KEYS.map((key) => PICKER_QUESTIONS[key].param)

/** Place categories give place cards interest tags without new data. */
export const CATEGORY_TAGS: Record<string, string[]> = {
  forty: ['istoriya'],
  zamki: ['istoriya'],
  plyazhi: ['more'],
  kurorty: ['more', 'priroda'],
  muzei: ['muzei'],
  eda: ['eda'],
}

/** Roles a text module can declare, so coverage knows what a page answers. */
export const TEXT_ROLES = ['events', 'open-closed', 'bad-weather', 'transport', 'pack', 'prices', 'faq', 'short-facts', 'route-steps', 'eat-nearby'] as const
export type TextRole = (typeof TEXT_ROLES)[number]

const tag = z.enum(PICKER_TAGS as [string, ...string[]])
const markdown = z.string().trim().min(1)
const title = z.string().trim().min(1).max(120)

const card = z.object({
  title,
  text: markdown,
  tags: z.array(tag).max(8).default([]),
})

export const pageModuleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    title: title.optional(),
    variant: z.enum(['lead', 'plain']).default('plain'),
    /** What the block answers, for persona coverage (ADR 0025). Not rendered. */
    role: z.enum(TEXT_ROLES).optional(),
    text: markdown,
  }),
  z.object({
    type: z.literal('month-stats'),
    title,
    verdict: z.string().trim().max(200).optional(),
    tiles: z.array(z.object({ label: title, value: z.string().trim().min(1).max(40), note: z.string().trim().max(80).optional() })).min(2).max(8),
    rows: z.array(z.object({ label: title, value: z.string().trim().min(1).max(60) })).max(30).default([]),
  }),
  z.object({
    type: z.literal('picker'),
    questions: z.array(z.enum(PICKER_QUESTION_KEYS as [PickerQuestion, ...PickerQuestion[]])).min(1).max(3),
  }),
  z.object({
    type: z.literal('ideas'),
    title,
    items: z.array(card).min(1).max(12),
  }),
  z.object({
    type: z.literal('plans'),
    title,
    items: z.array(card).min(1).max(8),
  }),
  z.object({
    type: z.literal('places'),
    title,
  }),
  z.object({
    type: z.literal('months'),
    title: title.optional(),
  }),
])

export const pageModulesSchema = z.array(pageModuleSchema).max(20).superRefine((modules, ctx) => {
  if (modules.filter((item) => item.type === 'picker').length > 1) {
    ctx.addIssue({ code: 'custom', message: 'A page has at most one picker module' })
  }
})

export type PageModule = z.infer<typeof pageModuleSchema>
export type PageModuleType = PageModule['type']

export type PickerState = Partial<Record<PickerQuestion, string[]>>

function firstValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value
}

/** Reads picker answers from a route query, dropping unknown values. */
export function parsePickerQuery(query: Record<string, unknown>, questions: readonly PickerQuestion[] = PICKER_QUESTION_KEYS): PickerState {
  const state: PickerState = {}
  for (const key of questions) {
    const spec = PICKER_QUESTIONS[key]
    const raw = firstValue(query[spec.param])
    if (typeof raw !== 'string' || !raw) {
      continue
    }
    const allowed = new Set<string>(spec.options.map((option) => option.value))
    const values = [...new Set(raw.split(',').filter((value) => allowed.has(value)))]
    const kept = spec.multiple ? values : values.slice(0, 1)
    if (kept.length) {
      state[key] = kept
    }
  }
  return state
}

/** The query for a picker state. Keys with no answer are omitted. */
export function pickerQuery(state: PickerState): Record<string, string> {
  const query: Record<string, string> = {}
  for (const key of PICKER_QUESTION_KEYS) {
    const values = state[key]
    if (values?.length) {
      query[PICKER_QUESTIONS[key].param] = values.join(',')
    }
  }
  return query
}

export function pickerActive(state: PickerState) {
  return PICKER_QUESTION_KEYS.some((key) => Boolean(state[key]?.length))
}

export interface PickerFit {
  /** Answered questions this card explicitly matches. */
  matched: number
  /** Answered questions this card is tagged for, but with other answers. */
  missed: number
}

/**
 * How a tagged card fits the answers. A card with no tags for a question is
 * neutral on it: it neither matches nor misses.
 */
export function pickerFit(tags: readonly string[], state: PickerState): PickerFit {
  const own = new Set(tags)
  let matched = 0
  let missed = 0
  for (const key of PICKER_QUESTION_KEYS) {
    const answers = state[key]
    if (!answers?.length) {
      continue
    }
    const vocabulary = PICKER_QUESTIONS[key].options.map((option) => option.value as string)
    const tagged = vocabulary.filter((value) => own.has(value))
    if (!tagged.length) {
      continue
    }
    if (tagged.some((value) => answers.includes(value))) {
      matched += 1
    } else {
      missed += 1
    }
  }
  return { matched, missed }
}

/** A card fits when it matches at least one answer and misses none. */
export function fitsPicker(fit: PickerFit) {
  return fit.matched > 0 && fit.missed === 0
}

/**
 * Stable order for cards under a picker state: fitting cards first (more
 * matches first), then neutral ones, then cards that miss an answer. Every
 * card stays in the list. Without answers the stored order is kept.
 */
export function rankByPicker<T>(items: readonly T[], tagsOf: (item: T) => readonly string[], state: PickerState) {
  const scored = items.map((item, index) => ({ item, index, fit: pickerFit(tagsOf(item), state) }))
  if (!pickerActive(state)) {
    return scored
  }
  return [...scored].sort((a, b) => (a.fit.missed - b.fit.missed) || (b.fit.matched - a.fit.matched) || (a.index - b.index))
}

export interface PublicCard {
  title: string
  html: string
  tags: string[]
}

export interface PublicPlaceCard {
  href: string
  title: string
  summary: string
  hub: string
  town: string
  kind: string
  tags: string[]
}

/** Modules as the page receives them: markdown is already HTML. */
export type PublicPageModule
  = | { type: 'text', title?: string, variant: 'lead' | 'plain', html: string }
    | { type: 'month-stats', title: string, verdict?: string, tiles: { label: string, value: string, note?: string }[], rows: { label: string, value: string }[] }
    | { type: 'picker', questions: PickerQuestion[] }
    | { type: 'ideas' | 'plans', title: string, items: PublicCard[] }
    | { type: 'places', title: string }
    | { type: 'months', title?: string }

/**
 * Validates stored modules and renders their markdown. A stored list that no
 * longer validates yields null, so the page falls back to the article body
 * instead of rendering half a frame.
 */
export function toPublicModules(stored: unknown, render: (markdown: string) => string): PublicPageModule[] | null {
  const parsed = pageModulesSchema.safeParse(stored)
  if (!parsed.success) {
    return null
  }
  return parsed.data.map((module): PublicPageModule => {
    switch (module.type) {
      case 'text':
        return { type: 'text', title: module.title, variant: module.variant, html: render(module.text) }
      case 'ideas':
      case 'plans':
        return { type: module.type, title: module.title, items: module.items.map((item) => ({ title: item.title, html: render(item.text), tags: item.tags })) }
      default:
        return module
    }
  })
}

export function categoryTags(kind: string) {
  return CATEGORY_TAGS[kind] ?? []
}

/** Fields a module page shows. `body` is not one of them. */
const MODULE_PAGE_FIELDS = ['title', 'summary', 'modules', 'seoTitle', 'seoDescription', 'sources', 'items'] as const

/** Fields an article collection shows. */
const ARTICLE_PAGE_FIELDS = ['title', 'summary', 'body', 'seoTitle', 'seoDescription', 'sources', 'items'] as const

/** A hub always renders its markdown body. */
export const HUB_RENDERED_FIELDS = ['title', 'description', 'body', 'seoTitle', 'seoDescription'] as const

/** Shown when a save tries to change `body` on a page that renders modules. */
export const COLLECTION_BODY_REJECTED = 'Поле body не показывается: страница собрана из модулей. Меняйте modules.'

export interface CollectionWritePlan {
  /** Which store is the article the visitor reads. */
  article: 'modules' | 'body'
  /** Fields that render, including the meta title and description. */
  renderedFields: readonly string[]
  /**
   * Body to store. Undefined keeps the current column (an article save that
   * omitted body). On a module page this is the projection of the modules.
   */
  body: string | undefined
  /** Prose the stop-list reads: the text that actually renders. */
  copy: string
  /** The client sent a body the page will not show. */
  rejectBody: boolean
}

function moduleBlock(module: PageModule): string {
  switch (module.type) {
    case 'text': {
      const text = module.text.trim()
      const title = module.title?.trim()
      return title ? `## ${title}\n\n${text}` : text
    }
    case 'month-stats': {
      const lines = [
        `## ${module.title.trim()}`,
        module.verdict?.trim() ?? '',
        ...module.tiles.map((tile) => [tile.label, tile.value, tile.note].filter(Boolean).join(' ')),
        ...module.rows.map((row) => `${row.label}: ${row.value}`),
      ]
      return lines.filter(Boolean).join('\n\n')
    }
    case 'ideas':
    case 'plans':
      return [
        `## ${module.title.trim()}`,
        ...module.items.map((item) => `### ${item.title.trim()}\n\n${item.text.trim()}`),
      ].join('\n\n')
    case 'places':
      return `## ${module.title.trim()}`
    case 'months':
      return module.title?.trim() ? `## ${module.title.trim()}` : ''
    case 'picker':
      return ''
  }
}

/** Markdown of the modules a visitor sees. Picker chips are UI, not prose. */
export function modulesArticle(modules: readonly PageModule[]): string {
  return modules.map((module) => moduleBlock(module)).filter(Boolean).join('\n\n')
}

/**
 * Article text for the public page, JSON-LD, and the score.
 * A valid non-empty module list wins. Anything else stays the stored body,
 * including a list that no longer validates: the page falls back to it.
 */
export function collectionArticle(row: { body?: string | null, modules?: unknown }): string {
  const parsed = pageModulesSchema.safeParse(row.modules ?? [])
  if (parsed.success && parsed.data.length > 0) {
    return modulesArticle(parsed.data)
  }
  return row.body ?? ''
}

/**
 * What a collection save may store.
 * When modules render they are the only article. `body` becomes their
 * projection so search, which reads that column, stays on the same text.
 * A body that is neither the current column nor that projection is rejected.
 */
export function collectionWritePlan(input: {
  sentBody: string | undefined
  currentBody: string | null | undefined
  modules: unknown
}): CollectionWritePlan {
  const parsed = pageModulesSchema.safeParse(input.modules ?? [])
  if (!parsed.success || parsed.data.length === 0) {
    return {
      article: 'body',
      renderedFields: ARTICLE_PAGE_FIELDS,
      body: input.sentBody,
      copy: input.sentBody ?? input.currentBody ?? '',
      rejectBody: false,
    }
  }
  const derived = modulesArticle(parsed.data)
  const sent = input.sentBody
  const current = input.currentBody ?? ''
  return {
    article: 'modules',
    renderedFields: MODULE_PAGE_FIELDS,
    body: derived,
    copy: derived,
    rejectBody: sent !== undefined && sent.trim() !== derived.trim() && sent.trim() !== current.trim(),
  }
}
