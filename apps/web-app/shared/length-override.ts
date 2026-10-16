import { writingHits } from './writing'

/** Hard cap for a justified page. The default ceilings in `lengthNorm` stay lower. */
export const LENGTH_HARD_CAP = 20_000

/** Days after `setAt` with no imported impressions before the score flags the override. */
export const LENGTH_OVERRIDE_STALE_DAYS = 60

const FILLER_PENALTY = 10
const SECTION_NEAR = 0.82
const PARAGRAPH_NEAR = 0.86
const MIN_SIMILAR_TOKENS = 12
const MIN_LENGTH_RATIO = 0.7
const PARAGRAPH_CHARS = 160
const SENTENCE_CHARS = 80
const MAX_SECTION_FLAGS = 3
const MAX_STOP_FLAGS = 4

export interface LengthSearchEvidence {
  impressions: number
  position: number
}

export interface LengthCompetitor {
  query: string
  chars: number
}

/** Stored on `page_passports.length_override`. `setAt` is stamped by the server. */
export interface LengthOverride {
  ceiling: number
  queries: string[]
  search: LengthSearchEvidence | null
  competitors: LengthCompetitor[]
  sections: string[]
  setAt: string
}

/** Client payload. The server adds `setAt` and drops empty evidence. */
export interface LengthOverrideInput {
  ceiling: number
  queries: string[]
  search?: LengthSearchEvidence | null
  competitors?: LengthCompetitor[] | null
  sections: string[]
}

export const LENGTH_OVERRIDE_IGNORED = 'length override ignored'
export const LENGTH_OVERRIDE_STALE = 'length override: no impressions after 60 days'
export const REPEATED_PARAGRAPH = 'repeated paragraph'

function cleanStrings(values: unknown, maxItems: number, maxLen: number) {
  if (!Array.isArray(values) || values.length < 1 || values.length > maxItems) {
    return null
  }
  const cleaned: string[] = []
  for (const value of values) {
    if (typeof value !== 'string') {
      return null
    }
    const text = value.trim()
    if (!text || text.length > maxLen) {
      return null
    }
    cleaned.push(text)
  }
  return cleaned
}

function validSearch(search: LengthOverrideInput['search']) {
  if (!search || typeof search !== 'object') {
    return false
  }
  return Number.isInteger(search.impressions)
    && search.impressions >= 1
    && typeof search.position === 'number'
    && Number.isFinite(search.position)
    && search.position > 0
    && search.position <= 100
}

function validCompetitors(rows: LengthOverrideInput['competitors']) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 10) {
    return false
  }
  return rows.every((row) => {
    return Boolean(row)
      && typeof row.query === 'string'
      && row.query.trim().length >= 1
      && row.query.trim().length <= 160
      && Number.isInteger(row.chars)
      && row.chars >= 1
      && row.chars <= 100_000
  })
}

/** Queries, plus impressions and a position or competitor lengths, plus the extra sections. */
export function lengthJustificationValid(input: Partial<LengthOverrideInput> | null | undefined) {
  if (!input || typeof input !== 'object') {
    return false
  }
  const ceiling = input.ceiling
  if (typeof ceiling !== 'number' || !Number.isInteger(ceiling) || ceiling < 1 || ceiling > LENGTH_HARD_CAP) {
    return false
  }
  if (!cleanStrings(input.queries, 20, 160) || !cleanStrings(input.sections, 12, 120)) {
    return false
  }
  return validSearch(input.search) || validCompetitors(input.competitors)
}

/**
 * Why a write should be refused, or null when the override may be stored.
 * `defaultMax` is the page's current ceiling from `lengthNorm`. Venues are refused by the caller.
 */
export function lengthOverrideRejection(defaultMax: number | null, override: LengthOverrideInput) {
  if (!Number.isInteger(override.ceiling) || override.ceiling < 1 || override.ceiling > LENGTH_HARD_CAP) {
    return 'Потолок не больше 20000'
  }
  if (defaultMax == null || override.ceiling <= defaultMax) {
    return `Потолок должен быть выше ${defaultMax ?? 0} и не больше 20000`
  }
  if (!lengthJustificationValid(override)) {
    return 'Нужны запросы, показы с позицией или длины конкурентов, и список разделов'
  }
  return null
}

function storedSearch(search: LengthOverrideInput['search']): LengthSearchEvidence | null {
  if (!validSearch(search) || !search) {
    return null
  }
  return { impressions: search.impressions, position: search.position }
}

function storedCompetitors(rows: LengthOverrideInput['competitors']): LengthCompetitor[] {
  if (!validCompetitors(rows) || !rows) {
    return []
  }
  return rows.map((row) => ({ query: row.query.trim(), chars: row.chars }))
}

function canonical(value: Omit<LengthOverride, 'setAt'>) {
  return JSON.stringify(value)
}

function normalize(input: LengthOverrideInput): Omit<LengthOverride, 'setAt'> {
  return {
    ceiling: input.ceiling,
    queries: input.queries.map((query) => query.trim()),
    search: storedSearch(input.search),
    competitors: storedCompetitors(input.competitors),
    sections: input.sections.map((section) => section.trim()),
  }
}

/** Keep `setAt` when the justification is unchanged, so a resave cannot reset the 60-day clock. */
export function stampLengthOverride(next: LengthOverrideInput | null, previous: LengthOverride | null, now = new Date()): LengthOverride | null {
  if (!next) {
    return null
  }
  const normalized = normalize(next)
  const prior = previous ? normalize(previous) : null
  const same = prior != null && canonical(normalized) === canonical(prior)
  const setAt = same && previous?.setAt ? previous.setAt : now.toISOString()
  return { ...normalized, setAt }
}

/** The extended ceiling, or null when the stored override must not change the score. */
export function lengthOverrideApplies(override: LengthOverride | null | undefined, defaultMax: number | null): LengthOverride | null {
  if (!override || typeof override !== 'object' || defaultMax == null) {
    return null
  }
  if (!lengthJustificationValid(override)) {
    return null
  }
  if (!Number.isInteger(override.ceiling) || override.ceiling <= defaultMax || override.ceiling > LENGTH_HARD_CAP) {
    return null
  }
  if (typeof override.setAt !== 'string' || Number.isNaN(new Date(override.setAt).getTime())) {
    return null
  }
  return override
}

export function lengthOverrideIsStale(override: LengthOverride, now: Date, searchImported: boolean, impressions: number) {
  if (!searchImported || impressions > 0) {
    return false
  }
  const setAt = new Date(override.setAt)
  if (Number.isNaN(setAt.getTime())) {
    return false
  }
  const age = Math.floor((now.getTime() - setAt.getTime()) / 86_400_000)
  return age >= LENGTH_OVERRIDE_STALE_DAYS
}

function fold(text: string) {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}.!?]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(text: string) {
  return fold(text)
    .replace(/[.!?]/g, ' ')
    .split(' ')
    .filter((word) => word.length >= 3 && !/^\d+$/.test(word))
}

function jaccard(left: string[], right: string[]) {
  if (!left.length || !right.length) {
    return 0
  }
  const a = new Set(left)
  const b = new Set(right)
  let shared = 0
  for (const word of a) {
    if (b.has(word)) {
      shared += 1
    }
  }
  const union = a.size + b.size - shared
  return union ? shared / union : 0
}

function similar(left: string, right: string, threshold: number) {
  const a = tokens(left)
  const b = tokens(right)
  if (a.length < MIN_SIMILAR_TOKENS || b.length < MIN_SIMILAR_TOKENS) {
    return false
  }
  const foldedLeft = fold(left).length
  const foldedRight = fold(right).length
  const ratio = Math.min(foldedLeft, foldedRight) / Math.max(foldedLeft, foldedRight)
  if (ratio < MIN_LENGTH_RATIO) {
    return false
  }
  return jaccard(a, b) >= threshold
}

function h2Heading(line: string) {
  const title = /^##[ \t]+(\S.*)$/.exec(line)?.[1]
  if (!title || title.startsWith('#')) {
    return null
  }
  return title.trim()
}

function h2Sections(text: string) {
  const sections: Array<{ heading: string, body: string }> = []
  let heading = ''
  let body: string[] = []
  let seen = false
  const flush = () => {
    const chunk = body.join('\n').trim()
    if (heading || chunk) {
      sections.push({ heading, body: chunk })
    }
  }
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const next = h2Heading(line)
    if (next != null) {
      if (seen) {
        flush()
      }
      seen = true
      heading = next
      body = []
      continue
    }
    seen = true
    body.push(line)
  }
  if (seen) {
    flush()
  }
  return sections
}

function repeatedSections(text: string) {
  const headed = h2Sections(text).filter((section) => section.heading && fold(section.body).length >= PARAGRAPH_CHARS)
  const checks: string[] = []
  const flagged = new Set<number>()
  for (let i = 0; i < headed.length; i += 1) {
    for (let j = i + 1; j < headed.length; j += 1) {
      if (flagged.has(j) || !similar(headed[i]!.body, headed[j]!.body, SECTION_NEAR)) {
        continue
      }
      flagged.add(j)
      checks.push(`repeated section: ${headed[j]!.heading.slice(0, 80)}`)
      if (checks.length >= MAX_SECTION_FLAGS) {
        return checks
      }
    }
  }
  return checks
}

function repeatedParagraph(text: string) {
  const seen = new Set<string>()
  for (const sentence of fold(text).split(/(?<=[.!?])\s+/)) {
    const line = sentence.trim()
    if (line.length < SENTENCE_CHARS) {
      continue
    }
    if (seen.has(line)) {
      return true
    }
    seen.add(line)
  }
  const blocks = text.split(/\n\s*\n/).map((part) => part.trim()).filter((part) => fold(part).length >= PARAGRAPH_CHARS)
  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      if (similar(blocks[i]!, blocks[j]!, PARAGRAPH_NEAR)) {
        return true
      }
    }
  }
  return false
}

/** Stop-list and near-duplicate sections. Only call this above the default ceiling. */
export function longPageFiller(text: string) {
  const checks = repeatedSections(text)
  if (repeatedParagraph(text)) {
    checks.push(REPEATED_PARAGRAPH)
  }
  for (const hit of writingHits(text)) {
    if (checks.length >= MAX_SECTION_FLAGS + 1 + MAX_STOP_FLAGS) {
      break
    }
    checks.push(`stop-list: ${hit.phrase}`)
  }
  return { points: checks.length ? -FILLER_PENALTY : 0, checks }
}
