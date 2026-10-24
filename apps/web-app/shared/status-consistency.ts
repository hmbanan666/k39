// Page text and the schedule must never contradict each other: a page that
// says «закрыт на реставрацию» cannot show hours, and «по записи» needs the
// appointment mode. A closure whose subject is another named thing in the
// same sentence (a tenant, a quoted name) is not about this page. ADR 0045.

// A bare opening status is a complete short form, not «Закрытую обувь».
// Use a Unicode letter boundary: JavaScript's \b does not delimit Cyrillic.
const CLOSED = /(?:закрыт\p{L}*|не работает)\s+(?:на|для|в связи с)\s+(?:реставрац|ремонт|реконструкц|консервац|посещени)|временно\s+(?:закрыт|не работает|не принимает)|(?:сейчас|пока)\s+(?:закрыт|не работает)|на реставрации|на реконструкции|посещение невозможно|не открыт\p{L}* для посещени|не приспособлен\p{L}* (?:для|к) посещени|свободного доступа нет|(?:осмотр\s+)?только\s+(?:осмотр\s+)?снаружи|внутрь\s+(?:\p{L}+\s+)?не пускают|^закрыт[аоы]?(?!\p{L})/imu
const APPOINTMENT = /по\s+(?:предварительн\p{L}*\s+)?(?:записи|договор[её]нност|заявк)/iu

// A tenant word names someone else. A «quoted name» does too only when it
// follows one of those words. Any other quote that is not this page's title
// is ambiguous, unless the words before it already name this page. ADR 0045.
const TENANT_WORDS = [String.raw`ресторан\p{L}*`, 'кафе', 'бар', String.raw`магазин\p{L}*`, String.raw`выставк\p{L}*`, String.raw`экспозици\p{L}*`]
const TENANT_WORD = TENANT_WORDS.join('|')
const TENANT = new RegExp(String.raw`(?:^|[^\p{L}])(?:${TENANT_WORD})(?!\p{L})|музе\p{L}*\s+внутри`, 'iu')
const TENANT_THEN_QUOTE = new RegExp(String.raw`(?:^|[^\p{L}])(?:${TENANT_WORD})\s+$`, 'iu')
const COORDINATING_CLAUSE_RESET = /,\s*(?:а|но)(?!\p{L})/iu
const CLAUSE_RESET = new RegExp(String.raw`${COORDINATING_CLAUSE_RESET.source}|(?:^|[^\p{L}])сам[ао]?(?!\p{L})`, 'giu')

// Appointment subjects also include attractions discussed on a town page.
// A matching type in the page title can still name the page itself.
const APPOINTMENT_HARD_NOUN_ENDINGS = '(?:а|у|ом|е|ы|ов|ам|ами|ах)?'
const APPOINTMENT_SUBJECTS = [
  // Only noun inflections: adjectives such as «музейном» modify a later head.
  `ресторан${APPOINTMENT_HARD_NOUN_ENDINGS}`,
  'кафе',
  `бар${APPOINTMENT_HARD_NOUN_ENDINGS}`,
  `магазин${APPOINTMENT_HARD_NOUN_ENDINGS}`,
  String.raw`выстав(?:к(?:а|и|е|у|ой|ою|ам|ами|ах)|ок)`,
  String.raw`экспозици(?:я|и|ю|ей|ею|й|ям|ями|ях)`,
  String.raw`музе(?:й|я|ю|ем|е|и|ев|ям|ями|ях)`,
  String.raw`пивовар(?:н(?:я|и|е|ю|ей|ею|ям|ями|ях)|ен)`,
  String.raw`конн(?:ый|ого|ому|ым|ом|ые|ых|ыми)\s+завод${APPOINTMENT_HARD_NOUN_ENDINGS}`,
].map((word) => new RegExp(String.raw`(?<!\p{L})(?:${word})(?!\p{L})`, 'iu'))
// Bounded noun-phrase cues, not a general morphology parser. Oblique forms
// still provide FAQ/location context when no clause subject is named.
const APPOINTMENT_HEAD = /^(?:рестораны?|кафе|бары?|магазины?|выставк[аи]|экспозици[яи]|музей|музеи|пивоварн[яи]|конн(?:ый|ые)\s+заводы?)$/iu
const APPOINTMENT_PREPOSITION = /(?:^|[^\p{L}])(?:[вуск]|во|на|при|около|возле|со|ко|из|от|для|без|над|под|перед|между|после|до|внутри)(?:\s+[\p{L}-]+(?:ым|им|ой|ей|ого|его|ому|ему|ом|ем|ую|юю|ых|их)){0,2}\s*$/iu

export const STATUS_SUBJECT_WARNING = 'closure may refer to another subject'

export interface StatusFaqItem {
  question?: string
  answer?: string
}

export interface StatusCheckInput {
  text: string
  /** Schedule rules mode; null when the page has no schedule. */
  mode: string | null
  /** FAQ answers as text; the question supplies an otherwise implicit appointment subject. */
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
  const parts = [
    { text: input.text, question: '' },
    ...(input.faq ?? []).map((item) => ({ text: answerSentence(item.answer ?? ''), question: item.question ?? '' })),
  ]
  return parts.flatMap(({ text, question }) => text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => ({ text: sentence.trim(), question }))
    .filter((sentence) => sentence.text && !sentence.text.includes('](/')))
}

type ClosureKind = 'definite' | 'other' | 'ambiguous'

interface AppointmentSubject {
  kind: ClosureKind
  complement: boolean
  index?: number
  end?: number
  coordinated?: boolean
}

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

/** The words before a historic name are this page: «Форт №5 «Король …»». */
function namesThisPage(text: string, title: string | null | undefined) {
  const page = normalizeName(title ?? '')
  const body = normalizeName(text)
  if (!page || !body) {
    return false
  }
  return body === page || ` ${body} `.includes(` ${page} `)
}

/**
 * `other` ignores the closure. `ambiguous` is a warning and costs nothing.
 * `null` means the quote is this page.
 */
function quotedSubject(quote: string, beforeQuote: string, title: string | null | undefined): 'other' | 'ambiguous' | null {
  if (TENANT_THEN_QUOTE.test(beforeQuote)) {
    return 'other'
  }
  if (quoteIsPageTitle(quote, title) || namesThisPage(beforeQuote, title)) {
    return null
  }
  return 'ambiguous'
}

function subjectKind(text: string, title: string | null | undefined): 'other' | 'ambiguous' | null {
  if (TENANT.test(text)) {
    return 'other'
  }
  let ambiguous = false
  for (const match of text.matchAll(/«([^»\n]{1,80})»/gu)) {
    const role = quotedSubject(match[1] ?? '', text.slice(0, match.index ?? 0), title)
    if (role === 'other') {
      return 'other'
    }
    if (role === 'ambiguous') {
      ambiguous = true
    }
  }
  return ambiguous ? 'ambiguous' : null
}

/** Only the existing coordinating resets may inherit an implicit subject. */
function scopeBoundary(sentence: string, index: number) {
  let boundary = { start: 0, index: 0, continuation: false }
  CLAUSE_RESET.lastIndex = 0
  for (const match of sentence.matchAll(CLAUSE_RESET)) {
    const end = (match.index ?? 0) + match[0].length
    if (end <= index) {
      boundary = { start: end, index: match.index ?? 0, continuation: COORDINATING_CLAUSE_RESET.test(match[0]) }
    }
  }
  return boundary
}

function scopeStart(sentence: string, index: number) {
  return scopeBoundary(sentence, index).start
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
    const beforeKind = subjectKind(before, title)
    if (beforeKind === 'other') {
      other = true
      continue
    }
    if (beforeKind === 'ambiguous' || subjectKind(after, title)) {
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

/** Appointment titles may be followed by punctuation, but not another letter/number. */
function appointmentPageIndex(text: string, title: string | null | undefined) {
  const name = normalizeName(title ?? '')
  if (!name) {
    return -1
  }
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}-])${escaped}(?![\\p{L}\\p{N}-])`, 'gu')
  return [...text.matchAll(pattern)].at(-1)?.index ?? -1
}

function followsAppointmentHead(normalized: string, previous: { end: number, complement: boolean } | undefined, index: number) {
  return Boolean(previous && !previous.complement && previous.end <= index && !normalized.slice(previous.end, index).trim())
}

/** The same bounded noun roles determine title heads and text attribution. */
function appointmentNouns(text: string) {
  const normalized = normalizeName(text)
  let nounText = normalized
  // Mask labels after normalization so every remaining noun keeps its offset.
  for (const match of text.matchAll(/«[^»\n]{1,80}»/gu)) {
    const start = normalizeName(text.slice(0, match.index)).length
    const end = normalizeName(text.slice(0, match.index + match[0].length)).length
    nounText = `${nounText.slice(0, start)}${'·'.repeat(end - start)}${nounText.slice(end)}`
  }
  const subjects: Array<{ index: number, end: number, pattern: RegExp, complement: boolean }> = []
  for (const pattern of APPOINTMENT_SUBJECTS) {
    for (const match of nounText.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
      subjects.push({
        index: match.index,
        end: match.index + match[0].length,
        pattern,
        complement: !APPOINTMENT_HEAD.test(match[0]) || APPOINTMENT_PREPOSITION.test(normalized.slice(0, match.index)),
      })
    }
  }
  // Only a subject/head can own an adjacent noun. A locative such as
  // «в музее» cannot turn the following «кафе» into its complement.
  subjects.sort((a, b) => a.index - b.index)
  for (let index = 1; index < subjects.length; index += 1) {
    const subject = subjects[index]!
    if (followsAppointmentHead(normalized, subjects[index - 1], subject.index)) {
      subject.complement = true
    }
  }
  return subjects
}

/** Prefer a clause subject over a locative/possessive complement or its quoted name. */
function appointmentSubject(text: string, title: string | null | undefined): AppointmentSubject | null {
  if (text.includes('](/')) {
    return { kind: 'other', complement: false }
  }
  const normalized = normalizeName(text)
  // A type in a possessive complement or quoted label is not the title's head.
  const titleHeads = appointmentNouns(title ?? '')
    .filter((subject) => !subject.complement)
    .map((subject) => subject.pattern)
  const subjects: Array<AppointmentSubject & { index: number, end: number }> = title
    ? appointmentNouns(text).map(({ index, end, pattern, complement }) => ({
        index, end, complement, kind: titleHeads.includes(pattern) ? 'definite' : 'other',
      }))
    : []
  const pageIndex = appointmentPageIndex(normalized, title)
  if (pageIndex >= 0) {
    const namedNoun = subjects.find((subject) => subject.index === pageIndex)
    const previousNoun = subjects.filter((subject) => subject.end <= pageIndex).at(-1)
    subjects.push({
      index: pageIndex,
      end: pageIndex + normalizeName(title ?? '').length,
      kind: 'definite',
      complement: namedNoun ? namedNoun.complement : APPOINTMENT_PREPOSITION.test(normalized.slice(0, pageIndex)) || followsAppointmentHead(normalized, previousNoun, pageIndex),
    })
  }
  for (const match of text.matchAll(/«([^»\n]{1,80})»/gu)) {
    const before = text.slice(0, match.index)
    const index = normalizeName(before).length
    const end = normalizeName(text.slice(0, match.index + match[0].length)).length
    const precedingSubject = subjects.filter((subject) => subject.index <= index).sort((a, b) => b.index - a.index)[0]
    const own = quoteIsPageTitle(match[1] ?? '', title)
      || appointmentPageIndex(normalizeName(before).slice(precedingSubject?.index ?? 0), title) >= 0
    const kind = own ? 'definite' : quotedSubject(match[1] ?? '', before, title) ?? 'ambiguous'
    if (precedingSubject && !APPOINTMENT_PREPOSITION.test(normalizeName(before))) {
      // A quoted label qualifies its noun, including an oblique complement;
      // it cannot promote that complement over the clause's subject.
      // A shared name cannot change an explicitly incompatible subject type.
      if (precedingSubject.kind !== 'other') {
        precedingSubject.kind = kind
      }
      precedingSubject.end = Math.max(precedingSubject.end, end)
    } else {
      subjects.push({ index, end, kind, complement: APPOINTMENT_PREPOSITION.test(normalizeName(before)) })
    }
  }
  const heads: Array<AppointmentSubject & { index: number, end: number }> = []
  for (const subject of subjects.sort((a, b) => a.index - b.index)) {
    const previous = heads.at(-1)
    if (subject.complement) {
      // Complements extend a noun phrase; they never become group members.
      if (previous && subject.index >= previous.end) {
        const gap = normalized.slice(previous.end, subject.index)
        if (!gap.trim() || APPOINTMENT_PREPOSITION.exec(gap)?.index === 0) {
          previous.end = Math.max(previous.end, subject.end)
        }
      }
    } else if (previous?.index === subject.index) {
      previous.end = Math.max(previous.end, subject.end)
    } else {
      heads.push({ ...subject })
    }
  }
  const last = heads.at(-1)
  if (!last) {
    return subjects[0] ?? null
  }
  const group = [last]
  let coordinated = false
  for (let index = heads.length - 2; index >= 0; index -= 1) {
    const head = heads[index]!
    const gap = normalized.slice(head.end, group[0]!.index)
    if (!/^\s*(?:и|,)\s*$/iu.test(gap)) {
      break
    }
    coordinated ||= /^\s*и\s*$/iu.test(gap)
    group.unshift(head)
  }
  if (!coordinated) {
    return last
  }
  return {
    ...last,
    index: group[0]!.index,
    coordinated,
    kind: group.some((head) => head.kind === 'definite')
      ? 'definite'
      : group.some((head) => head.kind === 'ambiguous') ? 'ambiguous' : 'other',
  }
}

/** Clause punctuation inside a quoted name does not introduce another subject. */
function appointmentFragments(text: string) {
  const parts: Array<{ text: string, separator: string | null }> = []
  let start = 0
  for (const match of text.matchAll(/«[^»\n]{1,80}»|[;,]/gu)) {
    if (match[0] === ',' || match[0] === ';') {
      parts.push({ text: text.slice(start, match.index), separator: match[0] })
      start = match.index + 1
    }
  }
  parts.push({ text: text.slice(start), separator: null })
  return parts
}

function appointmentPreviousContext(parts: ReturnType<typeof appointmentFragments>, title: string | null | undefined) {
  const location = parts.at(-2)
  const preceding = parts.at(-3)
  // A comma-bracketed location can inherit its head, but cannot displace
  // an explicit subject in the active booking clause.
  let context = location?.separator === ',' && preceding?.separator === ','
    && appointmentSubject(location.text, title)?.complement
    ? appointmentSubject(preceding.text, title)
    : null
  for (let previous = parts.length - 2; !context && previous >= 0; previous -= 1) {
    const part = parts[previous]!
    if (part.separator !== ',') {
      break
    }
    context = appointmentSubject(part.text, title)
  }
  return context
}

function ownAppointment(sentence: string, question: string, title: string | null | undefined) {
  for (const match of sentence.matchAll(new RegExp(APPOINTMENT.source, `${APPOINTMENT.flags}g`))) {
    const index = match.index
    const boundary = scopeBoundary(sentence, index)
    const start = boundary.start
    const parts = appointmentFragments(sentence.slice(start, index))
    let before = parts.at(-1)?.text ?? ''
    let beforeSubject = appointmentSubject(before, title)
    // A comma list may prefix an explicit coordinated group with noun-only
    // fragments. A preceding predicate or location cannot join that group.
    if (beforeSubject?.coordinated && beforeSubject.index === 0) {
      for (let previous = parts.length - 2; previous >= 0; previous -= 1) {
        const part = parts[previous]!
        const member = appointmentSubject(part.text, title)
        if (part.separator !== ',' || !member || member.complement
          || member.index !== 0 || member.end !== normalizeName(part.text).length) {
          break
        }
        before = `${part.text}, ${before}`
        beforeSubject = appointmentSubject(before, title)
      }
    }
    const after = appointmentFragments(sentence.slice(index + match[0].length))[0]?.text ?? ''
    const candidates = [beforeSubject, appointmentSubject(after, title)]
      .filter((subject) => subject != null)
    let context = appointmentPreviousContext(parts, title)
    let parent = boundary
    // An implicit adversative continuation may reuse its preceding context.
    // Current candidates, semicolons and explicit сам/сама/само still win.
    while (!candidates.length && !context && parent.continuation) {
      const parentBoundary = scopeBoundary(sentence, parent.index)
      const parentParts = appointmentFragments(sentence.slice(parentBoundary.start, parent.index))
      context = appointmentSubject(parentParts.at(-1)?.text ?? '', title)
        ?? appointmentPreviousContext(parentParts, title)
      if (parentParts.some((part) => part.separator === ';')) {
        break
      }
      parent = parentBoundary
    }
    // A location before the booking phrase cannot override a subject after it.
    const subject = candidates.find((candidate) => !candidate.complement)
      ?? candidates[0]
      ?? context
      ?? appointmentSubject(start ? '' : question, title)
    if (subject == null || subject.kind === 'definite') {
      return true
    }
  }
  return false
}

/** Short English check strings. Warnings do not take the closed-text penalty. */
export function statusChecks(input: StatusCheckInput): StatusCheckResult {
  const sentences = ownSentences(input)
  let definite = false
  let ambiguous = false
  for (const { text: sentence } of sentences) {
    const kind = closureKind(sentence, input.title)
    if (kind === 'definite') {
      definite = true
    } else if (kind === 'ambiguous') {
      ambiguous = true
    }
  }
  const appointmentText = sentences.some(({ text, question }) => ownAppointment(text, question, input.title))
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
