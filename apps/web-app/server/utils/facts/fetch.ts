import { Buffer } from 'node:buffer'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { inflateRawSync, inflateSync } from 'node:zlib'
import { isBlockedAddress, isBlockedHostname, isUnwatchedUrl, normalizeSourceText, sha256 } from '../../../shared/facts'

const USER_AGENT = 'K39/1.0 (https://k39.online; https://github.com/hmbanan666/k39) source-watch'
const MAX_BYTES = 2_000_000
const MAX_REDIRECTS = 5

export interface SourceFetch {
  status: number
  hash: string | null
  etag: string | null
  lastModified: string | null
  error: boolean
}

export async function assertPublicSource(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Bad source URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Source URL must be http(s)')
  }
  if (url.username || url.password) {
    throw new Error('Source URL rejects credentials')
  }
  if (isBlockedHostname(url.hostname) || isUnwatchedUrl(url.toString())) {
    throw new Error('Source URL is not watchable')
  }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((item) => item.address)
  if (!addresses.length || addresses.some((address) => isBlockedAddress(address))) {
    throw new Error('Source URL resolves to a blocked address')
  }
  return url
}

export async function fetchWatchable(raw: string, etag: string | null): Promise<SourceFetch> {
  let current = raw
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let url: URL
    try {
      url = await assertPublicSource(current)
    } catch {
      return { status: 0, hash: null, etag: null, lastModified: null, error: true }
    }
    let response: Response
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
        headers: {
          'user-agent': USER_AGENT,
          'accept': 'text/html,application/pdf,text/plain;q=0.9,*/*;q=0.1',
          ...(etag && hop === 0 ? { 'if-none-match': etag } : {}),
        },
      })
    } catch {
      return { status: 0, hash: null, etag: null, lastModified: null, error: true }
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) {
        return { status: response.status, hash: null, etag: null, lastModified: null, error: true }
      }
      current = new URL(location, url).toString()
      continue
    }
    const nextEtag = response.headers.get('etag')
    const lastModified = response.headers.get('last-modified')
    if (response.status === 304) {
      return { status: 304, hash: null, etag: nextEtag ?? etag, lastModified, error: false }
    }
    if (response.status >= 500 || response.status === 408 || response.status === 429) {
      return { status: response.status, hash: null, etag: nextEtag, lastModified, error: true }
    }
    if (response.status === 404 || response.status === 410) {
      return { status: response.status, hash: null, etag: nextEtag, lastModified, error: false }
    }
    if (!response.ok) {
      return { status: response.status, hash: null, etag: nextEtag, lastModified, error: true }
    }
    const declared = Number(response.headers.get('content-length') || 0)
    if (declared > MAX_BYTES) {
      return { status: response.status, hash: null, etag: nextEtag, lastModified, error: true }
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > MAX_BYTES) {
      return { status: response.status, hash: null, etag: nextEtag, lastModified, error: true }
    }
    const type = response.headers.get('content-type') ?? ''
    const pdf = type.includes('pdf') || url.pathname.toLowerCase().endsWith('.pdf')
    const text = pdf ? extractPdfText(bytes) : normalizeSourceText(bytes.toString('utf8'))
    if (pdf && text == null) {
      return { status: response.status, hash: null, etag: nextEtag, lastModified, error: true }
    }
    return { status: response.status, hash: sha256(text ?? ''), etag: nextEtag, lastModified, error: false }
  }
  return { status: 0, hash: null, etag: null, lastModified: null, error: true }
}

/** Best-effort text from a menu PDF. A failure is a fetch failure, not a new fact. */
export function extractPdfText(bytes: Buffer): string | null {
  const raw = bytes.toString('latin1')
  const parts: string[] = []
  const stream = /stream\r?\n([\s\S]*?)endstream/g
  for (const match of raw.matchAll(stream)) {
    const body = Buffer.from(match[1] ?? '', 'latin1')
    parts.push(body.toString('latin1'))
    parts.push(inflateMaybe(body))
  }
  const text = parts.flatMap(readPdfStrings).join(' ').replace(/\s+/g, ' ').trim()
  return text || null
}

function inflateMaybe(body: Buffer) {
  try {
    return inflateSync(body).toString('latin1')
  } catch {
    try {
      return inflateRawSync(body).toString('latin1')
    } catch {
      return ''
    }
  }
}

function readPdfStrings(chunk: string) {
  const found: string[] = []
  const pattern = /\((?:\\.|[^\\)]){1,400}\)\s*Tj/g
  for (const match of chunk.matchAll(pattern)) {
    found.push(unescapePdf(match[0].slice(1, match[0].lastIndexOf(')'))))
  }
  const arrays = /\[(.*?)\]\s*TJ/gs
  for (const match of chunk.matchAll(arrays)) {
    for (const piece of (match[1] ?? '').matchAll(/\((?:\\.|[^\\)]){1,400}\)/g)) {
      found.push(unescapePdf(piece[0].slice(1, -1)))
    }
  }
  return found
}

function unescapePdf(value: string) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
}
