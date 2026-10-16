// Display grouping for a Russian phone. The stored fact text is not rewritten.
// Kaliningrad city is the 4-digit code 4012, then six digits (30-30-40).
// Other codes in the 401 zone are 5-digit district codes such as 40153 (2-23-53).
// Mobiles are 9xx, then seven digits (851-68-55). tel: and JSON-LD use E.164.

export interface ParsedPhone {
  /** Grouped number, plus a short trailing note such as "p6" when the fact has one. */
  display: string
  /** E.164 with a leading plus. Empty when the fragment is not a full number. */
  e164: string
}

const SEPARATOR = /[\s();.-]/

function phonePattern() {
  // +7 or a trunk 8, then 10 national digits. A bare 7 is the country code
  // without a plus. A bare 10-digit run is already the national number.
  return /(?:\+\s*7|8)(?:[\s().-]*\d){10}(?!\d)|(?<!\d)7(?:[\s().-]*\d){10}(?!\d)|(?<!\d)(?:\d[\s().-]*){9}\d(?!\d)/g
}

function nationalDigits(match: string) {
  const digits = match.replace(/\D/g, '')
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return digits.slice(1)
  }
  if (digits.length === 10) {
    return digits
  }
  return ''
}

/** +7 4012 30-30-40, +7 40153 2-23-53, +7 911 851-68-55. */
function formatNational(national: string) {
  if (national.startsWith('4012')) {
    const rest = national.slice(4)
    return `+7 4012 ${rest.slice(0, 2)}-${rest.slice(2, 4)}-${rest.slice(4)}`
  }
  if (national.startsWith('401')) {
    const code = national.slice(0, 5)
    const rest = national.slice(5)
    return `+7 ${code} ${rest.slice(0, 1)}-${rest.slice(1, 3)}-${rest.slice(3)}`
  }
  const code = national.slice(0, 3)
  const rest = national.slice(3)
  return `+7 ${code} ${rest.slice(0, 3)}-${rest.slice(3, 5)}-${rest.slice(5)}`
}

function cleanGap(gap: string) {
  return gap
    .replace(/^[\s;,/|]+|[\s;,/|]+$/g, '')
    .replace(/^(?:и|или)$/i, '')
    .replace(/^(?:и|или)\s+/i, '')
    .trim()
}

function isNote(text: string) {
  return !text.includes('+') && text.replace(/\D/g, '').length < 6 && !SEPARATOR.test(text[0] ?? '')
}

/**
 * One entry per number, in the order written. A fragment that is not a full
 * Russian number stays as text with an empty `e164`, so the page does not
 * invent digits and does not drop the fact.
 */
export function parsePhones(raw: string | null | undefined): ParsedPhone[] {
  const text = raw?.trim() ?? ''
  if (!text) {
    return []
  }
  const hits: Array<{ start: number, end: number, national: string }> = []
  for (const match of text.matchAll(phonePattern())) {
    const national = nationalDigits(match[0])
    if (!national) {
      continue
    }
    const start = match.index ?? 0
    hits.push({ start, end: start + match[0].length, national })
  }
  if (!hits.length) {
    return [{ display: text, e164: '' }]
  }
  const items: ParsedPhone[] = []
  let cursor = 0
  for (const hit of hits) {
    pushGap(items, text.slice(cursor, hit.start))
    items.push({ display: formatNational(hit.national), e164: `+7${hit.national}` })
    cursor = hit.end
  }
  pushGap(items, text.slice(cursor))
  return items
}

function pushGap(items: ParsedPhone[], gap: string) {
  const cleaned = cleanGap(gap)
  if (!cleaned) {
    return
  }
  const previous = items.at(-1)
  if (previous?.e164 && isNote(cleaned)) {
    previous.display = `${previous.display} ${cleaned}`
    return
  }
  items.push({ display: cleaned, e164: '' })
}

/** Display text. Unparseable facts, including «уточняйте», stay as written. */
export function formatPhoneDisplay(raw: string | null | undefined) {
  const text = raw?.trim() ?? ''
  const items = parsePhones(text)
  if (!items.some((item) => item.e164)) {
    return text
  }
  return items.map((item) => item.display).join('; ')
}

/** E.164 numbers only. Fragments and «уточняйте» are omitted. */
export function phoneE164List(raw: string | null | undefined) {
  return parsePhones(raw).flatMap((item) => item.e164 ? [item.e164] : [])
}

/** `tel:` of the first complete number. Several numbers are separate links. */
export function telHref(phone: string | null | undefined) {
  const e164 = phoneE164List(phone)[0]
  return e164 ? `tel:${e164}` : ''
}
