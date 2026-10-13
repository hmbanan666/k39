const SITE_HOSTS = new Set(['k39.online', 'www.k39.online', 'localhost', '127.0.0.1'])

const SEARCH: Array<[string, string]> = [
  ['yandex.', 'organic:yandex'],
  ['ya.ru', 'organic:yandex'],
  ['google.', 'organic:google'],
  ['bing.', 'organic:other'],
  ['duckduckgo.', 'organic:other'],
  ['mail.ru', 'organic:other'],
  ['rambler.', 'organic:other'],
]

const SOCIAL: Array<[string, string]> = [
  ['vk.com', 'social:vk'],
  ['vk.ru', 'social:vk'],
  ['t.me', 'social:tg'],
  ['telegram.', 'social:tg'],
  ['ok.ru', 'social:other'],
  ['facebook.', 'social:other'],
  ['instagram.', 'social:other'],
  ['youtube.', 'social:other'],
  ['twitter.', 'social:other'],
  ['x.com', 'social:other'],
  ['dzen.ru', 'social:other'],
]

const BOT = /bot|crawl|spider|slurp|headless|phantom|selenium|wget|curl|python-requests|go-http|httpclient|scrapy|ahrefs|semrush|dotbot|petalbot|bytespider|gptbot|claudebot|facebookexternalhit|telegrambot|whatsapp|yandexbot|googlebot|bingbot|duckduckbot|applebot|preview/i

export function isBotUserAgent(ua: string) {
  const value = ua.trim()
  if (!value) {
    return true
  }
  return BOT.test(value)
}

export function hostOf(value: string | null | undefined) {
  if (!value) {
    return ''
  }
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function hostMatches(host: string, needle: string) {
  const name = host.toLowerCase()
  if (needle.endsWith('.')) {
    const brand = needle.slice(0, -1)
    return name === brand || name.startsWith(`${brand}.`) || name.endsWith(`.${brand}`) || name.includes(`.${brand}.`)
  }
  return name === needle || name.endsWith(`.${needle}`)
}

function matchHost(host: string, pairs: Array<[string, string]>) {
  return pairs.find(([needle]) => hostMatches(host, needle))?.[1] ?? ''
}

export function searchQueryFromReferrer(referrer: string) {
  try {
    const url = new URL(referrer)
    for (const key of ['q', 'text', 'query', 'p', 'wd']) {
      const value = url.searchParams.get(key)?.trim()
      if (value) {
        return value.slice(0, 200)
      }
    }
  } catch {
    return ''
  }
  return ''
}

export function classifyChannel(input: { referrer?: string | null, utmSource?: string | null, utmMedium?: string | null }) {
  const referrer = input.referrer?.trim() || ''
  const host = hostOf(referrer)
  const medium = (input.utmMedium || '').toLowerCase()
  const source = (input.utmSource || '').toLowerCase()
  const bare = host.replace(/^www\./, '')
  if (bare && (SITE_HOSTS.has(bare) || SITE_HOSTS.has(host))) {
    return { channel: 'internal', referrerHost: host, searchQuery: '' }
  }
  if (medium === 'cpc' || medium === 'ppc' || medium === 'paid' || medium === 'cpm') {
    return { channel: 'paid', referrerHost: host, searchQuery: '' }
  }
  const search = matchHost(host, SEARCH) || (source === 'yandex' ? 'organic:yandex' : source === 'google' ? 'organic:google' : '')
  if (search && (host || medium === 'organic' || source)) {
    const organic = search.startsWith('organic:') ? search : `organic:${search}`
    return { channel: organic, referrerHost: host, searchQuery: searchQueryFromReferrer(referrer) }
  }
  const social = matchHost(host, SOCIAL)
    || (source === 'vk' ? 'social:vk' : source === 'tg' || source === 'telegram' ? 'social:tg' : '')
  if (social || medium === 'social') {
    return { channel: social || 'social:other', referrerHost: host, searchQuery: '' }
  }
  if (host) {
    return { channel: 'referral', referrerHost: host, searchQuery: '' }
  }
  return { channel: 'direct', referrerHost: '', searchQuery: '' }
}

export function parseUserAgent(ua: string) {
  const value = ua || ''
  const low = value.toLowerCase()
  const bot = isBotUserAgent(value)
  let device: 'mobile' | 'tablet' | 'desktop' = 'desktop'
  if (/ipad|tablet/.test(low)) {
    device = 'tablet'
  } else if (/mobile|iphone|android/.test(low)) {
    device = 'mobile'
  }
  let browser = 'other'
  if (/edg\//.test(low)) {
    browser = 'edge'
  } else if (/yabrowser/.test(low)) {
    browser = 'yandex'
  } else if (/firefox\//.test(low)) {
    browser = 'firefox'
  } else if (/chrome\//.test(low)) {
    browser = 'chrome'
  } else if (/safari\//.test(low)) {
    browser = 'safari'
  }
  let os = 'other'
  if (/android/.test(low)) {
    os = 'android'
  } else if (/iphone|ipad|ios/.test(low)) {
    os = 'ios'
  } else if (/windows/.test(low)) {
    os = 'windows'
  } else if (/mac os/.test(low)) {
    os = 'macos'
  } else if (/linux/.test(low)) {
    os = 'linux'
  }
  return { device, browser, os, bot }
}

export function screenBucket(width: number | string | null | undefined) {
  if (typeof width === 'string' && ['xs', 'sm', 'md', 'lg', 'xl'].includes(width)) {
    return width
  }
  const size = typeof width === 'number' ? width : Number(width)
  if (!Number.isFinite(size) || size <= 0) {
    return ''
  }
  if (size < 480) {
    return 'xs'
  }
  if (size < 768) {
    return 'sm'
  }
  if (size < 1024) {
    return 'md'
  }
  if (size < 1440) {
    return 'lg'
  }
  return 'xl'
}

export function scrollBucket(depth: number | string | null | undefined) {
  const value = typeof depth === 'number' ? depth : Number(depth)
  if (!Number.isFinite(value) || value <= 0) {
    return '0'
  }
  if (value < 25) {
    return '0'
  }
  if (value < 50) {
    return '25'
  }
  if (value < 75) {
    return '50'
  }
  if (value < 100) {
    return '75'
  }
  return '100'
}

export function resolvePeriod(period = '28d', now = Date.now()) {
  const match = /^(\d+)(d|h)$/.exec(period.trim())
  const amount = match ? Number(match[1]) : 28
  const length = amount * (match?.[2] === 'h' ? 3_600_000 : 86_400_000)
  const to = new Date(now)
  const from = new Date(now - length)
  return {
    label: match ? period.trim() : '28d',
    from,
    to,
    previousFrom: new Date(from.getTime() - length),
    previousTo: from,
  }
}

export function utmFromPath(path: string) {
  const query = path.split('?')[1] || ''
  const params = new URLSearchParams(query)
  return {
    utmSource: params.get('utm_source') || '',
    utmMedium: params.get('utm_medium') || '',
    utmCampaign: params.get('utm_campaign') || '',
  }
}

export const COLLECT_TYPES = ['pageview', 'engage', 'outbound', 'photo', 'impression', 'directions', 'pin_impression', 'pin_click'] as const

export interface HitEntity {
  placeId: string | null
  routeId: string | null
  venueId: string | null
}

export function mergeHitEntities(page: HitEntity, entity: HitEntity | null, shown: HitEntity | null): HitEntity {
  return {
    placeId: entity?.placeId ?? shown?.placeId ?? page.placeId,
    routeId: page.routeId ?? entity?.routeId ?? shown?.routeId ?? null,
    venueId: entity?.venueId ?? shown?.venueId ?? page.venueId,
  }
}

export function trendPercent(current: number, previous: number) {
  if (!previous) {
    return null
  }
  return Math.round(((current - previous) / previous) * 1000) / 10
}
