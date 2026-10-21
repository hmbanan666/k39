import type { SourceLink } from './types/entities'

/**
 * How many source rows a page may store.
 * A venue cites the official site, a social profile, a menu file, the map
 * cards, and per-price menu pages. The old cap of 12 dropped the rest.
 */
export const SOURCE_LINK_LIMIT = 24

const TITLE_MAX = 160
const URL_MAX = 500

export class SourceInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SourceInputError'
  }
}

export function sourceLimitMessage() {
  return `Не больше ${SOURCE_LINK_LIMIT} источников`
}

export interface SourceLinkInput {
  title?: string | null
  url?: string | null
}

/**
 * Validate, trim, and dedupe source rows.
 * The same page (trailing slash, a leading www, and http/https) counts once.
 * The stored URL is the first row, trimmed. Invalid rows throw; nothing is dropped.
 */
export function prepareSourceLinks(rows: readonly SourceLinkInput[] | null | undefined): SourceLink[] | undefined {
  if (rows == null) {
    return undefined
  }
  const kept: SourceLink[] = []
  const seen = new Set<string>()
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? {}
    const title = row.title?.trim() ?? ''
    const url = row.url?.trim() ?? ''
    if (!title) {
      throw new SourceInputError(sourceRowMessage(index, row, 'title'))
    }
    const key = sourceUrlKey(url)
    if (!key) {
      throw new SourceInputError(sourceRowMessage(index, row, 'url'))
    }
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    kept.push({
      title: title.slice(0, TITLE_MAX),
      url: url.slice(0, URL_MAX),
    })
  }
  if (kept.length > SOURCE_LINK_LIMIT) {
    throw new SourceInputError(sourceLimitMessage())
  }
  return kept
}

function sourceRowMessage(index: number, row: SourceLinkInput, problem: 'title' | 'url') {
  const hint = (row.title?.trim() || row.url?.trim() || '').slice(0, 80)
  const label = hint ? `Источник ${index + 1} (${hint})` : `Источник ${index + 1}`
  if (problem === 'title') {
    return `${label}: нужна подпись`
  }
  return `${label}: ссылка должна начинаться с http:// или https://`
}

/** Identity of a citation URL. Null when the value is not an http(s) URL. */
export function sourceUrlKey(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null
  }
  let host = parsed.hostname.toLowerCase()
  if (host.startsWith('www.')) {
    host = host.slice(4)
  }
  if (!host) {
    return null
  }
  const port = parsed.port && parsed.port !== '80' && parsed.port !== '443' ? `:${parsed.port}` : ''
  const path = parsed.pathname.replace(/\/+$/, '')
  return `${host}${port}${path}${parsed.search}`
}
