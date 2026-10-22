import { isSocialHost } from './social-hosts'

/**
 * What a URL is, for every claim that needs the subject's own page: a place
 * or venue website, a place phone source, a venue menu.
 * `official` is a page on the subject's own site. `document` is a file on
 * Drive, Docs, or Yandex Disk. Maps and map business cards, third-party
 * listings and guides, social networks, and other Google or Yandex services
 * are not the subject's own page.
 */
export type OfficialUrlClass = 'official' | 'document' | 'map' | 'aggregator' | 'social' | 'service' | 'invalid'

const GOOGLE_SITE = /(?:^|\.)google\.(?:com|ru|de|fr|co\.uk|lt|pl|kz|by)$/
const YANDEX_SITE = /(?:^|\.)yandex\.(?:ru|com|by|kz|uz)$/

/** Listings, review sites, ticket and booking resellers, guides, and delivery. Subdomains count. */
const AGGREGATOR_HOSTS = [
  'delivery-club.ru',
  'tomesto.ru',
  'chibbis.ru',
  'kudago.com',
  'afisha.ru',
  'zoon.ru',
  'flamp.ru',
  'yell.ru',
  'restoclub.ru',
  'restoran.ru',
  'otzovik.com',
  'irecommend.ru',
  'sputnik8.com',
  'tripster.ru',
  'tutu.ru',
  'ostrovok.ru',
  'booking.com',
  '101hotels.com',
  'tonkosti.ru',
  'kartaslov.ru',
  'wikipedia.org',
  'wikivoyage.org',
] as const

function parsedHttpUrl(url: string | null | undefined) {
  const text = url?.trim() ?? ''
  if (!text) {
    return null
  }
  try {
    const parsed = new URL(text)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    const host = parsed.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
    if (!host) {
      return null
    }
    return { host, pathname: parsed.pathname }
  } catch {
    return null
  }
}

function isYandexHost(host: string) {
  return YANDEX_SITE.test(host) || host === 'ya.ru' || host.endsWith('.ya.ru')
}

function onHost(host: string, name: string) {
  return host === name || host.endsWith(`.${name}`)
}

/** Drive, Docs, and Yandex Disk. Checked before the Google and Yandex service ban. */
function isDocumentHost(host: string) {
  if (onHost(host, 'drive.google.com') || onHost(host, 'docs.google.com') || onHost(host, 'yadi.sk')) {
    return true
  }
  return /(?:^|\.)disk\.yandex\.[a-z0-9-]+(?:\.[a-z0-9-]+)?$/.test(host)
}

/** Maps and the Yandex business card (`/maps/org/...`, `/profile/...`). */
function isMapUrl(host: string, pathname: string) {
  if (host.startsWith('maps.') || onHost(host, 'goo.gl')) {
    return true
  }
  if (/(?:^|\.)2gis\.(?:ru|com|kz|uz)$/.test(host)) {
    return true
  }
  if (/(?:^|\.)openstreetmap\.org$/.test(host) || onHost(host, 'osm.org') || onHost(host, 'wikimapia.org')) {
    return true
  }
  if (GOOGLE_SITE.test(host) && (pathname === '/maps' || pathname.startsWith('/maps/'))) {
    return true
  }
  return isYandexHost(host) && (pathname.includes('/maps') || pathname === '/profile' || pathname.startsWith('/profile/'))
}

function isAggregator(host: string, pathname: string) {
  if (/(?:^|\.)eda\.yandex\.(?:ru|com|by|kz|uz)$/.test(host) || /(?:^|\.)tripadvisor\.[a-z.]+$/.test(host)) {
    return true
  }
  if (AGGREGATOR_HOSTS.some((name) => onHost(host, name))) {
    return true
  }
  return isYandexHost(host) && (pathname === '/eda' || pathname.startsWith('/eda/'))
}

export function classifyOfficialUrl(url: string | null | undefined): OfficialUrlClass {
  const parsed = parsedHttpUrl(url)
  if (!parsed) {
    return 'invalid'
  }
  if (isDocumentHost(parsed.host)) {
    return 'document'
  }
  if (isMapUrl(parsed.host, parsed.pathname)) {
    return 'map'
  }
  if (isAggregator(parsed.host, parsed.pathname)) {
    return 'aggregator'
  }
  if (isSocialHost(parsed.host)) {
    return 'social'
  }
  if (isYandexHost(parsed.host) || GOOGLE_SITE.test(parsed.host)) {
    return 'service'
  }
  return 'official'
}

/** An http(s) page on the subject's own site. */
export function isOfficialUrl(url: string | null | undefined) {
  return classifyOfficialUrl(url) === 'official'
}

export type OwnWebsiteProblem = Exclude<OfficialUrlClass, 'official'>

/** Why a value cannot be the «Сайт» of a place or a venue, or null when it can. */
export function ownWebsiteProblem(url: string): OwnWebsiteProblem | null {
  const kind = classifyOfficialUrl(url)
  return kind === 'official' ? null : kind
}

export function ownWebsiteMessage(problem: OwnWebsiteProblem) {
  if (problem === 'invalid') {
    return 'В поле «Сайт» нужна ссылка http:// или https:// на собственный сайт'
  }
  if (problem === 'social') {
    return 'В поле «Сайт» укажите только собственный сайт, не соцсеть. У заведения ссылку на соцсеть добавьте в «Соцсети».'
  }
  return 'В поле «Сайт» укажите только собственный сайт. Карта, агрегатор, файл или сервис Яндекса и Google сюда не подходят.'
}
