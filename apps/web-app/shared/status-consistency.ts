// Page text and the schedule must never contradict each other: a page that
// says «закрыт на реставрацию» cannot show hours, and «по записи» needs the
// appointment mode. A closure whose subject is another named thing in the
// same sentence (a tenant, a quoted name) is not about this page. ADR 0045.

const CLOSED = /(?:закрыт\p{L}*|не работает)\s+(?:на|для|в связи с)\s+(?:реставрац|ремонт|реконструкц|консервац|посещени)|временно\s+(?:закрыт|не работает|не принимает)|(?:сейчас|пока)\s+(?:закрыт|не работает)|на реставрации|на реконструкции|посещение невозможно|не открыт\p{L}* для посещени|не приспособлен\p{L}* (?:для|к) посещени|свободного доступа нет|(?:осмотр\s+)?только\s+(?:осмотр\s+)?снаружи|внутрь\s+(?:\p{L}+\s+)?не пускают|^закрыт/imu
const APPOINTMENT = /по\s+(?:предварительн\p{L}*\s+)?(?:записи|договор[её]нност|заявк)/iu

// Tenant words name someone else. A quoted name does too when it follows
// one of those words, or when it is not this page's title. ADR 0045.
const TENANT_WORD = String.raw`ресторан\p{L}*|кафе|бар|магазин\p{L}*|выставк\p{L}*|экспозици\p{L}*`
const TENANT = new RegExp(String.raw`(?:^|[^\p{L}])(?:${TENANT_WORD})(?!\p{L})|музе\p{L}*\s+внутри`, 'iu')
const TENANT_THEN_QUOTE = new RegExp(String.raw`(?:^|[^\p{L}])(?:${TENANT_WORD})\s+$`, 'iu')
const CLAUSE_RESET = /,\s*(?:а|но)(?!\p{L})|(?:^|[^\p{L}])сам[ао]?(?!\p{L})/giu

export const STATUS_SUBJECT_WARNING = 'closure may refer to another subject'

export interface StatusFaqItem {
  question?: string
  answer?: string
}

export interface StatusCheckInput {
  text: string
  /** Schedule rules mode; null when the page has no schedule. */
  mode: string | null
  /** FAQ answers, as text. The check does not read a JSON encoding of this array. */
  faq?: StatusFaqItem[]
  /** Page title. A «quoted name» that is this title is the place, not a tenant. */
  title?: string | null
}

export interface StatusCheckResult {
  contradictions: string[]
  warnings: string[]
}

function answerSentence(answer: string) {
  const text = answer.trim()
  if (!text) {
    return ''
  }
  return /[.!?…]$/u.test(text) ? text : `${text}.`
}

function ownSentences(input: StatusCheckInput) {
  const answers = (input.faq ?? []).map((item) => answerSentence(item.answer ?? '')).filter(Boolean)
  const text = [input.text, ...answers].filter((part) => part.trim()).join('\n')
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !sentence.includes('](/'))
}

type ClosureKind = 'definite' | 'other' | 'ambiguous'

function normalizeName(value: string) {
  return value.replace(/[«»„“”"]/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru')
}

/** The quoted name is this page when the title contains it as its own words. */
function quoteIsPageTitle(quote: string, title: string | null | undefined) {
  const name = normalizeName(quote)
  const page = normalizeName(title ?? '')
  if (!name || !page) {
    return false
  }
  return page === name || ` ${page} `.includes(` ${name} `)
}

function quoteIsOtherSubject(quote: string, beforeQuote: string, title: string | null | undefined) {
  if (TENANT_THEN_QUOTE.test(beforeQuote)) {
    return true
  }
  return !quoteIsPageTitle(quote, title)
}

function hasOtherSubject(text: string, title: string | null | undefined) {
  if (TENANT.test(text)) {
    return true
  }
  for (const match of text.matchAll(/«([^»\n]{1,80})»/gu)) {
    const index = match.index ?? 0
    if (quoteIsOtherSubject(match[1] ?? '', text.slice(0, index), title)) {
      return true
    }
  }
  return false
}

/** «, а», «, но», and сам/сама/само start a new subject. Earlier words do not apply. */
function scopeStart(sentence: string, index: number) {
  let start = 0
  CLAUSE_RESET.lastIndex = 0
  for (const match of sentence.matchAll(CLAUSE_RESET)) {
    const end = (match.index ?? 0) + match[0].length
    if (end <= index) {
      start = end
    }
  }
  return start
}

function closureKind(sentence: string, title: string | null | undefined): ClosureKind | null {
  const pattern = new RegExp(CLOSED.source, `${CLOSED.flags}g`)
  let other = false
  let ambiguous = false
  for (const match of sentence.matchAll(pattern)) {
    const index = match.index ?? 0
    const before = sentence.slice(scopeStart(sentence, index), index)
    // A tenant after a comma is another clause. It does not steal this closure.
    const after = (sentence.slice(index + match[0].length).split(',')[0] ?? '')
    if (hasOtherSubject(before, title)) {
      other = true
      continue
    }
    if (hasOtherSubject(after, title)) {
      ambiguous = true
      continue
    }
    return 'definite'
  }
  if (ambiguous) {
    return 'ambiguous'
  }
  if (other) {
    return 'other'
  }
  return null
}

/** Short English check strings. Warnings do not take the closed-text penalty. */
export function statusChecks(input: StatusCheckInput): StatusCheckResult {
  const sentences = ownSentences(input)
  let definite = false
  let ambiguous = false
  for (const sentence of sentences) {
    const kind = closureKind(sentence, input.title)
    if (kind === 'definite') {
      definite = true
    } else if (kind === 'ambiguous') {
      ambiguous = true
    }
  }
  const own = sentences.join('\n')
  const appointmentText = APPOINTMENT.test(own)
  const contradictions: string[] = []
  if (definite && input.mode !== 'closed') {
    contradictions.push(`text says closed, schedule mode is ${input.mode ?? 'missing'}`)
  }
  if (input.mode === 'closed' && !definite) {
    contradictions.push('schedule closed, text does not say so')
  }
  if (input.mode === 'appointment' && !appointmentText) {
    contradictions.push('schedule by appointment, text does not say how to book')
  }
  if (appointmentText && !definite && input.mode === 'always') {
    contradictions.push('text says by appointment, schedule is always open')
  }
  // A closed schedule already asks the editor to say so. The warning is for
  // an open schedule that might be describing someone else.
  const warnings = ambiguous && !definite && input.mode !== 'closed'
    ? [STATUS_SUBJECT_WARNING]
    : []
  return { contradictions, warnings }
}

/** Hard contradictions only. Empty when text and status agree. */
export function statusContradictions(input: StatusCheckInput): string[] {
  return statusChecks(input).contradictions
}
