import { transliterateSlug } from './seo'

/** A table of contents is shown only when the body has at least this many h2 sections. */
export const READER_TOC_MIN_H2 = 3

export interface ReaderHeading {
  id: string
  text: string
  level: 2 | 3
}

export interface ReaderTocItem {
  id: string
  text: string
  children: Array<{ id: string, text: string }>
}

/** Offer passed into the reader slot. Absent data renders nothing. */
export interface ReaderPartner {
  title: string
  terms: string
  href: string
  anchor?: string
}

export function headingPlain(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Old heading anchors kept working after a section was renamed. */
export const HEADING_ALIASES: Record<string, string> = {
  praktika: 'polezno-znat',
}

/** Latin slug for a heading. Cyrillic is transliterated; a leading digit is prefixed. */
export function headingId(text: string, used: Map<string, number>, prefix = '') {
  const raw = transliterateSlug(headingPlain(text)) || 'section'
  const safe = /^[a-z]/.test(raw) ? raw : `s-${raw}`
  const base = `${prefix}${safe}`
  const seen = used.get(base) ?? 0
  used.set(base, seen + 1)
  if (seen === 0) {
    return base
  }
  return `${base}-${seen + 1}`
}

function plainText(html: string) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export function readerOutline(html: string): ReaderHeading[] {
  const items: ReaderHeading[] = []
  const pattern = /<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g
  for (const match of html.matchAll(pattern)) {
    const level = match[1] === '2' ? 2 : 3
    const id = match[2] ?? ''
    const text = plainText(match[3] ?? '')
    if (!id || !text) {
      continue
    }
    items.push({ id, text, level })
  }
  return items
}

export function showReaderToc(html: string, blocks = 0) {
  const h2 = readerOutline(html).filter((item) => item.level === 2).length
  return h2 + blocks >= READER_TOC_MIN_H2
}

export function readerTree(html: string): ReaderTocItem[] {
  const tree: ReaderTocItem[] = []
  for (const heading of readerOutline(html)) {
    const previous = tree[tree.length - 1]
    if (heading.level === 3 && previous) {
      previous.children.push({ id: heading.id, text: heading.text })
      continue
    }
    tree.push({ id: heading.id, text: heading.text, children: [] })
  }
  return tree
}

/** HTML before the second h2, and the remainder. The partner sits between them. */
export function splitAfterFirstSection(html: string) {
  const pattern = /<h2\b/g
  let count = 0
  for (const found of html.matchAll(pattern)) {
    count += 1
    if (count === 2 && found.index !== undefined) {
      return { before: html.slice(0, found.index), after: html.slice(found.index) }
    }
  }
  return { before: html, after: '' }
}

/**
 * Last heading whose top is at or above `line`.
 * `headings` must be in document order.
 */
export function activeHeadingId(headings: Array<{ id: string, top: number }>, line: number) {
  let current = ''
  for (const heading of headings) {
    if (heading.top <= line) {
      current = heading.id
    }
  }
  return current
}

/** The reader slot stays empty unless sponsored venues are on and the offer is complete. */
export function readerPartner(enabled: boolean, partner: Partial<ReaderPartner> | null | undefined): ReaderPartner | null {
  if (enabled !== true || !partner) {
    return null
  }
  const title = partner.title?.trim() ?? ''
  const terms = partner.terms?.trim() ?? ''
  const href = partner.href?.trim() ?? ''
  if (!title || !terms || !href) {
    return null
  }
  const anchor = partner.anchor?.trim()
  if (anchor) {
    return { title, terms, href, anchor }
  }
  return { title, terms, href }
}
