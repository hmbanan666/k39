import type { PersonaCode } from './personas'
import { PERSONAS } from './personas'

// Persona coverage (ADR 0025). Static: which blocks a page already has with
// real data, compared with the blocks each persona needs. No traffic data.

/** Blocks a page can provide. Names match persona `modules` in the registry. */
export type CoverageBlock = string

export interface CoveragePage {
  pageType: 'place' | 'route' | 'collection' | 'quest' | 'hub' | 'venue'
  hasBody: boolean
  modules: Array<{ type: string, role?: unknown }>
  stops: number
  sources: number
  faq: number
  hours: boolean
  price: boolean
  howToGet: boolean
}

/** Blocks the page provides, derived from stored data only. */
export function pageBlocks(page: CoveragePage): Set<CoverageBlock> {
  const blocks = new Set<CoverageBlock>()
  if (page.hasBody) {
    blocks.add('text')
  }
  if (page.sources) {
    blocks.add('sources')
  }
  if (page.faq) {
    blocks.add('faq')
  }
  if (page.hours || page.price) {
    blocks.add('short-facts')
  }
  if (page.howToGet) {
    blocks.add('transport')
  }
  if (page.stops) {
    blocks.add('places')
  }
  if ((page.pageType === 'route' || page.pageType === 'quest') && page.stops >= 2) {
    blocks.add('route-steps')
    blocks.add('route-map')
  }
  if (page.pageType === 'quest') {
    blocks.add('quest')
  }
  for (const module of page.modules) {
    blocks.add(module.type)
    if (module.type === 'text' && typeof module.role === 'string') {
      blocks.add(module.role)
    }
  }
  return blocks
}

export interface PersonaCoverage {
  code: PersonaCode
  score: number
  missing: string[]
}

/** Share of a persona's blocks the page has, 0..100, plus what is missing. */
export function personaCoverage(code: PersonaCode, blocks: ReadonlySet<CoverageBlock>): PersonaCoverage {
  const persona = PERSONAS.find((item) => item.code === code)
  const wanted: readonly string[] = persona?.modules ?? []
  const missing = wanted.filter((block) => !blocks.has(block))
  const score = wanted.length ? Math.round(100 * (wanted.length - missing.length) / wanted.length) : 100
  return { code, score, missing }
}

/** A targeted persona below this score is a gap. */
export const COVERAGE_GAP = 50

/** Block names as editors read them in the admin. */
export const BLOCK_TITLES: Record<string, string> = {
  'text': 'текст',
  'sources': 'источники',
  'faq': 'вопросы',
  'short-facts': 'короткие факты',
  'transport': 'как добраться',
  'places': 'места',
  'route-steps': 'шаги маршрута',
  'route-map': 'карта маршрута',
  'quest': 'квест',
  'picker': 'пикер',
  'ideas': 'идеи',
  'plans': 'готовые дни',
  'month-stats': 'месяц в цифрах',
  'months': 'месяцы',
  'events': 'события',
  'open-closed': 'открыто / закрыто',
  'bad-weather': 'если погода подвела',
  'pack': 'что взять',
  'prices': 'цены',
  'highlights': 'главное',
  'compare-table': 'сравнение',
  'eat-nearby': 'где поесть рядом',
  'sea-today': 'море сегодня',
  'nearby': 'рядом',
}

export function blockTitle(block: string) {
  return BLOCK_TITLES[block] ?? block
}
