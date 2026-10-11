import { Buffer } from 'node:buffer'

export const WIKIMEDIA_USER_AGENT = 'K39/1.0 (https://k39.online; https://github.com/hmbanan666/k39) media-pipeline'

const ALLOWED_HOSTS = new Set(['commons.wikimedia.org', 'upload.wikimedia.org'])

export interface CommonsHit {
  title: string
  pageUrl: string
  thumbUrl: string
  fileUrl: string
  author: string
  license: 'cc0' | 'pd' | 'cc-by' | 'cc-by-sa'
  licenseName: string
  width: number
  height: number
}

export function mapCommonsLicense(shortName: string) {
  const value = shortName.toLowerCase()
  if (value.includes('nc') || value.includes('nd') || value.includes('noncommercial')) {
    return null
  }
  if (value.includes('cc0') || value.includes('zero')) {
    return 'cc0' as const
  }
  if (value.includes('public domain') || value === 'pd' || value.includes('общественное')) {
    return 'pd' as const
  }
  if (value.includes('by-sa') || value.includes('bysa')) {
    return 'cc-by-sa' as const
  }
  if (value.includes('cc by') || value.includes('cc-by') || value === 'by') {
    return 'cc-by' as const
  }
  return null
}

export function assertWikimediaUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error('Only Wikimedia HTTPS URLs can be imported')
  }
  return url
}

interface ApiPage {
  title?: string
  imageinfo?: Array<{
    url?: string
    thumburl?: string
    descriptionurl?: string
    mime?: string
    width?: number
    height?: number
    extmetadata?: Record<string, { value?: string }>
  }>
}

async function commonsQuery(params: Record<string, string>) {
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  url.searchParams.set('action', 'query')
  url.searchParams.set('format', 'json')
  url.searchParams.set('prop', 'imageinfo')
  url.searchParams.set('iiprop', 'url|extmetadata|mime|size')
  url.searchParams.set('iiurlwidth', '320')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const response = await fetch(url, {
    headers: {
      'user-agent': WIKIMEDIA_USER_AGENT,
      'api-user-agent': WIKIMEDIA_USER_AGENT,
    },
  })
  if (!response.ok) {
    throw new Error(`Commons answered ${response.status}`)
  }
  const body = await response.json() as { query?: { pages?: Record<string, ApiPage> } }
  return Object.values(body.query?.pages ?? {})
}

function toHit(page: ApiPage): CommonsHit | null {
  const info = page.imageinfo?.[0]
  if (!info?.url || !info.descriptionurl || !page.title) {
    return null
  }
  const shortName = info.extmetadata?.LicenseShortName?.value || ''
  const license = mapCommonsLicense(shortName)
  if (!license) {
    return null
  }
  const mime = info.mime || ''
  if (mime && mime !== 'image/jpeg' && mime !== 'image/png' && mime !== 'image/webp') {
    return null
  }
  const author = stripHtml(info.extmetadata?.Artist?.value || '')
  return {
    title: page.title.replace(/^File:/, ''),
    pageUrl: info.descriptionurl,
    thumbUrl: info.thumburl || info.url,
    fileUrl: info.url,
    author,
    license,
    licenseName: shortName,
    width: info.width || 0,
    height: info.height || 0,
  }
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function searchCommons(input: { lat?: number | null, lng?: number | null, title?: string | null }) {
  const hits: CommonsHit[] = []
  if (input.lat != null && input.lng != null) {
    const pages = await commonsQuery({
      generator: 'geosearch',
      ggscoord: `${input.lat}|${input.lng}`,
      ggsradius: '1000',
      ggslimit: '12',
      ggsnamespace: '6',
    })
    hits.push(...pages.map(toHit).filter((item): item is CommonsHit => Boolean(item)))
  }
  const title = input.title?.trim()
  if (title) {
    const pages = await commonsQuery({
      generator: 'search',
      gsrsearch: title,
      gsrnamespace: '6',
      gsrlimit: '8',
    })
    hits.push(...pages.map(toHit).filter((item): item is CommonsHit => Boolean(item)))
  }
  const seen = new Set<string>()
  return hits.filter((hit) => {
    if (seen.has(hit.pageUrl)) {
      return false
    }
    seen.add(hit.pageUrl)
    return true
  })
}

export async function downloadWikimedia(fileUrl: string) {
  assertWikimediaUrl(fileUrl)
  const response = await fetch(fileUrl, { headers: { 'user-agent': WIKIMEDIA_USER_AGENT } })
  if (!response.ok) {
    throw new Error(`Download failed ${response.status}`)
  }
  const mime = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
  const bytes = Buffer.from(await response.arrayBuffer())
  return { mime, bytes }
}
