import { stripRepeatedLead } from './seo'

const ABBREVIATIONS = new Set([
  'ул',
  'д',
  'г',
  'пр',
  'пер',
  'пл',
  'наб',
  'корп',
  'стр',
  'им',
  'т',
  'к',
  'о',
  'обл',
  'пос',
  'ш',
  'б-р',
  'пр-т',
  'пгт',
  'мкр',
  'кв',
  'лит',
  'эт',
])

function isLetter(char: string) {
  return char.toLowerCase() !== char.toUpperCase()
}

function wordBefore(text: string, index: number) {
  let start = index
  while (start > 0 && (isLetter(text[start - 1] ?? '') || text[start - 1] === '-')) {
    start -= 1
  }
  return text.slice(start, index).toLowerCase()
}

export function shortAddress(value: string) {
  const text = value.replace(/\s+/g, ' ').trim()
  if (!text) {
    return ''
  }
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '.') {
      continue
    }
    if (ABBREVIATIONS.has(wordBefore(text, index))) {
      continue
    }
    const next = text[index + 1]
    if (next === undefined || next === ' ') {
      return text.slice(0, index + 1).trim()
    }
  }
  return text
}

/** True when rendered directions already include this street address. */
export function htmlContainsAddress(html: string | null | undefined, address: string | null | undefined) {
  const full = address?.trim().toLowerCase()
  if (!html || !full) {
    return false
  }
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
  if (text.includes(full)) {
    return true
  }
  const street = full.replace(/^[^,]+,\s*/, '')
  return street.length > 4 && street !== full && text.includes(street)
}

export function articleBody(summary: string, body: string, howToGet: string | null | undefined) {
  const article = stripRepeatedLead(summary, body)
  const directions = howToGet?.trim()
  if (!directions || article.includes(directions) || /^##[ \t]+Как добраться[ \t]*$/m.test(article)) {
    return article
  }
  return `${article}\n\n## Как добраться\n\n${directions}`
}
