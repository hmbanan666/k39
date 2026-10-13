import type { PublicMedia } from './media'
import { licenseHref, licenseLabel, openGraphFile } from './media'

export const SITE_ORIGIN = 'https://k39.online'
export const SITE_NAME = 'K39'
export const DEFAULT_OG_IMAGE = {
  url: `${SITE_ORIGIN}/og-default.jpg`,
  width: 1200,
  height: 630,
  alt: 'K39',
  type: 'image/jpeg',
}

// The file name says 512. The VP8X canvas is 576 by 512, so the logo node uses that box.
export const ORGANIZATION_LOGO = {
  url: `${SITE_ORIGIN}/logo/moose-head-512.webp`,
  width: 576,
  height: 512,
}

export const GEO_REGION = 'RU-KGD'

export function publicRobots(noindex = false) {
  return noindex
    ? 'noindex, follow, max-image-preview:large'
    : 'index, follow, max-image-preview:large'
}

// Unhead dedupes <link> on rel+href unless each tag has its own key.
// favicon.ico is linked twice (48x48 and any), so the keys must stay distinct.
export const brandHeadLinks = [
  { key: 'icon-ico-48', rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
  { key: 'icon-ico-any', rel: 'icon', href: '/favicon.ico', sizes: 'any' },
  { key: 'icon-32', rel: 'icon', type: 'image/png', href: '/favicon-32.png', sizes: '32x32' },
  { key: 'icon-16', rel: 'icon', type: 'image/png', href: '/favicon-16.png', sizes: '16x16' },
  { key: 'apple-touch-icon', rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
  { key: 'manifest', rel: 'manifest', href: '/site.webmanifest' },
] as const

export const RESERVED_SLUGS = [
  'about',
  'cookies',
  'admin',
  'api',
  'eda',
  'forty',
  'health',
  'kvesty',
  'kurorty',
  'legal',
  'map',
  'marshruty',
  'mcp',
  'media',
  'muzei',
  'place',
  'plyazhi',
  'podborki',
  'preview',
  'privacy',
  'quest',
  'robots',
  'search',
  'sign-in',
  'sitemap',
  'soglasie',
  'sitemaps',
  'terms',
  'zamki',
  'zavedeniya',
] as const

const RU: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

export function transliterateSlug(value: string) {
  const lowered = value.trim().toLowerCase()
  const mapped = lowered.split('').map((char) => RU[char] ?? char).join('')
  return mapped.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function slugError(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return 'Адрес: только латиница, цифры и дефисы, без слэша в конце.'
  }
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
    return 'Этот адрес занят разделом сайта.'
  }
  return null
}

export function verificationMeta(yandex?: string | null, google?: string | null) {
  const tags: Array<{ name: string, content: string }> = []
  const yandexToken = yandex?.trim()
  const googleToken = google?.trim()
  if (yandexToken) {
    tags.push({ name: 'yandex-verification', content: yandexToken })
  }
  if (googleToken) {
    tags.push({ name: 'google-site-verification', content: googleToken })
  }
  return tags
}

export function absoluteUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}

// `{title} | K39`, or `{seoTitle} | K39` when an override is set.
// The type word (квест, маршрут, раздел) is not appended, so a title that already names the type is not repeated.
export function pageTitle(title: string, seoTitle?: string | null) {
  const custom = seoTitle?.trim()
  const base = (custom || title).replace(/\s+/g, ' ').trim()
  if (!base) {
    return SITE_NAME
  }
  if (base.includes(SITE_NAME)) {
    return base
  }
  return `${base} | ${SITE_NAME}`
}

export function metaDescription(fallback: string, override?: string | null) {
  const text = (override?.trim() || fallback).replace(/\s+/g, ' ').trim()
  if (text.length <= 170) {
    return text
  }
  return `${text.slice(0, 167).replace(/\s+\S*$/, '')}...`
}

export function titleWarning(title: string) {
  if (title.length > 70) {
    return `Заголовок ${title.length} знаков, для поиска лучше до 70.`
  }
  if (title.length < 15) {
    return 'Заголовок слишком короткий.'
  }
  return null
}

export function descriptionWarning(description: string) {
  if (!description.trim()) {
    return 'Нет описания для поиска.'
  }
  if (description.length > 170) {
    return `Описание ${description.length} знаков, лучше до 170.`
  }
  if (description.length < 50) {
    return 'Описание короче 50 знаков.'
  }
  return null
}

export interface Crumb {
  name: string
  href: string
}

export interface SeoImage {
  url: string
  width: number | null
  height: number | null
  alt: string
  type?: string
  author?: string | null
  license?: string | null
  sourceUrl?: string | null
}

export interface SeoDocument {
  title: string
  description: string
  canonical: string
  robots: string
  h1: string
  crumbs: Crumb[]
  jsonLd: Record<string, unknown>[]
  ogImage: SeoImage
}

export function organizationNode() {
  return {
    '@type': 'Organization',
    'name': SITE_NAME,
    'url': SITE_ORIGIN,
    'logo': {
      '@type': 'ImageObject',
      'url': ORGANIZATION_LOGO.url,
      'contentUrl': ORGANIZATION_LOGO.url,
      'width': ORGANIZATION_LOGO.width,
      'height': ORGANIZATION_LOGO.height,
    },
  }
}

export function websiteNode() {
  return {
    '@type': 'WebSite',
    'name': SITE_NAME,
    'url': SITE_ORIGIN,
    'inLanguage': 'ru',
    'publisher': { '@id': `${SITE_ORIGIN}/#organization` },
  }
}

export function breadcrumbNode(crumbs: Crumb[]) {
  return {
    '@type': 'BreadcrumbList',
    'itemListElement': crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': crumb.name,
      'item': absoluteUrl(crumb.href),
    })),
  }
}

export function homeDocument(): SeoDocument {
  const title = pageTitle('Куда сходить в Калининградской области')
  const description = metaDescription('Форты, замки, пляжи, курорты, музеи и еда Калининградской области: статус, часы и как добраться.')
  return {
    title,
    description,
    canonical: `${SITE_ORIGIN}/`,
    robots: publicRobots(),
    h1: 'Куда сходить в Калининградской области',
    crumbs: [],
    ogImage: DEFAULT_OG_IMAGE,
    jsonLd: [
      { ...organizationNode(), '@id': `${SITE_ORIGIN}/#organization` },
      websiteNode(),
    ],
  }
}

const SCHEMA_BY_CATEGORY: Record<string, string> = {
  forty: 'LandmarksOrHistoricalBuildings',
  // schema.org has no Castle type. A castle page is still a historical building.
  zamki: 'LandmarksOrHistoricalBuildings',
  plyazhi: 'Beach',
  muzei: 'Museum',
  kurorty: 'TouristAttraction',
  eda: 'TouristAttraction',
}

export function placeSchemaType(categorySlug: string) {
  return SCHEMA_BY_CATEGORY[categorySlug] ?? 'TouristAttraction'
}

export function placeNodeTypes(categorySlug: string): string | string[] {
  const specific = placeSchemaType(categorySlug)
  if (specific === 'TouristAttraction') {
    return 'TouristAttraction'
  }
  return ['TouristAttraction', specific]
}

const FOOD_SERVICE = new Set(['cafe', 'restaurant', 'coffee', 'bar', 'bakery', 'fastfood'])

export function venueSchemaType(kind: string) {
  if (kind === 'cafe' || kind === 'coffee') {
    return 'CafeOrCoffeeShop'
  }
  return FOOD_SERVICE.has(kind) ? 'Restaurant' : 'LocalBusiness'
}

const TITLE_MAX = 70

export function intentTitle(name: string, intent: string, seoTitle?: string | null) {
  const custom = seoTitle?.trim()
  if (custom) {
    return pageTitle(name, custom)
  }
  const base = name.replace(/\s+/g, ' ').trim()
  const extra = intent.replace(/\s+/g, ' ').trim()
  const already = extra && base.toLowerCase().includes(extra.toLowerCase())
  const combined = !extra || already ? base : `${base}: ${extra}`
  const titled = pageTitle(combined)
  if (titled.length >= 15 && titled.length <= TITLE_MAX) {
    return titled
  }
  const plain = pageTitle(base)
  if (plain.length <= TITLE_MAX) {
    return plain
  }
  const room = TITLE_MAX - ` | ${SITE_NAME}`.length
  const cut = base.slice(0, room).replace(/\s+\S*$/, '').trim() || base.slice(0, room)
  return pageTitle(cut)
}

const DESCRIPTION_FLOOR = 'Справочник K39 по Калининградской области: места, часы и как добраться.'

export function pageDescription(summary: string, override?: string | null, facts: Array<string | null | undefined> = []) {
  const custom = override?.trim()
  if (custom) {
    return metaDescription(custom)
  }
  let text = summary.replace(/\s+/g, ' ').trim()
  for (const fact of facts) {
    const bit = fact?.replace(/\s+/g, ' ').trim()
    if (!bit || text.toLowerCase().includes(bit.toLowerCase())) {
      continue
    }
    if (text.length >= 50) {
      break
    }
    text = text ? `${text} ${bit}` : bit
  }
  if (text.length < 50 && !text.includes(SITE_NAME)) {
    const withShort = text ? `${text} Справочник ${SITE_NAME}.` : `Справочник ${SITE_NAME}.`
    text = withShort.length >= 50 ? withShort : (text ? `${text} ${DESCRIPTION_FLOOR}` : DESCRIPTION_FLOOR)
  }
  return metaDescription(text)
}

const SCHEMA_DAY_RU: Record<string, string> = {
  пн: 'Mo',
  вт: 'Tu',
  ср: 'We',
  чт: 'Th',
  пт: 'Fr',
  сб: 'Sa',
  вс: 'Su',
}

function schemaClock(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match?.[1] || !match[2]) {
    return null
  }
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour === 24 && minute === 0) {
    return '23:59'
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// Only a whole string that names the days is emitted. A bare range or a note is left out.
export function schemaOpeningHours(raw: string | null | undefined) {
  const text = (raw || '').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase()
  if (!text) {
    return null
  }
  const daily = /^(?:ежедневно|каждый день|без выходных|пн-вс)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(text)
  if (daily?.[1] && daily[2]) {
    const opens = schemaClock(daily[1])
    const closes = schemaClock(daily[2])
    return opens && closes ? `Mo-Su ${opens}-${closes}` : null
  }
  const range = /^(пн|вт|ср|чт|пт|сб|вс)-(пн|вт|ср|чт|пт|сб|вс)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(text)
  if (range?.[1] && range[2] && range[3] && range[4]) {
    const opens = schemaClock(range[3])
    const closes = schemaClock(range[4])
    const start = SCHEMA_DAY_RU[range[1]]
    const end = SCHEMA_DAY_RU[range[2]]
    if (!opens || !closes || !start || !end) {
      return null
    }
    return start === end ? `${start} ${opens}-${closes}` : `${start}-${end} ${opens}-${closes}`
  }
  const one = /^(пн|вт|ср|чт|пт|сб|вс)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(text)
  if (one?.[1] && one[2] && one[3]) {
    const opens = schemaClock(one[2])
    const closes = schemaClock(one[3])
    const day = SCHEMA_DAY_RU[one[1]]
    return opens && closes && day ? `${day} ${opens}-${closes}` : null
  }
  return null
}

export function accessibleForFree(price: string | null | undefined) {
  const text = (price || '').replace(/\s+/g, ' ').trim().toLowerCase()
  if (!text) {
    return null
  }
  const amounts = [...text.matchAll(/(\d+(?: \d+)*)\s*(?:₽|руб\.?)/g)]
    .map((match) => Number((match[1] || '').replace(/\s/g, '')))
    .filter((value) => Number.isFinite(value))
  const freeWord = /бесплатн/.test(text)
  const positive = amounts.filter((value) => value > 0)
  const zero = amounts.filter((value) => value === 0)
  if (positive.length && (freeWord || zero.length)) {
    return null
  }
  if (positive.length === 1 && !freeWord) {
    return false
  }
  if (positive.length > 1) {
    return null
  }
  if (freeWord && !positive.length) {
    return true
  }
  if (zero.length && !positive.length && !/[1-9]/.test(text)) {
    return true
  }
  return null
}

function geoNode(latitude?: number | null, longitude?: number | null) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null
  }
  return {
    '@type': 'GeoCoordinates',
    latitude,
    longitude,
  }
}

function postalAddress(streetAddress?: string | null, addressLocality?: string | null) {
  const street = streetAddress?.trim()
  const locality = addressLocality?.trim()
  if (!street && !locality) {
    return null
  }
  const address: Record<string, unknown> = {
    '@type': 'PostalAddress',
    'addressRegion': 'Калининградская область',
    'addressCountry': 'RU',
  }
  if (street) {
    address.streetAddress = street
  }
  if (locality) {
    address.addressLocality = locality
  }
  return address
}

export function socialImage(media: PublicMedia, alt: string): SeoImage {
  const file = openGraphFile(media)
  return {
    url: absoluteUrl(file.path),
    width: file.width,
    height: file.height,
    alt,
    ...(file.type ? { type: file.type } : {}),
    author: media.author,
    license: media.license,
    sourceUrl: media.sourceUrl,
  }
}

function placeIntent(hours?: string | null) {
  return hours?.trim() ? 'часы и как добраться' : 'как добраться'
}

const COLLECTION_INTENT: Record<string, string> = {
  раздел: 'Калининградская область',
  маршрут: 'остановки по порядку',
  подборка: 'места по теме',
  квест: 'точки и задания',
  список: 'Калининградская область',
}

function collectionIntent(crumbName?: string) {
  return COLLECTION_INTENT[crumbName || ''] || 'Калининградская область'
}

function venueIntent(input: { hours?: VenueSeoInput['hours'], cuisine?: string[], priceLevel?: number | null }) {
  const bits: string[] = []
  if ((input.hours ?? []).some((day) => !day.closed && day.opens && day.closes)) {
    bits.push('часы')
  }
  if (input.cuisine?.some((item) => item.trim())) {
    bits.push('кухня')
  }
  if (input.priceLevel) {
    bits.push('чек')
  }
  if (!bits.length) {
    return 'адрес и как дойти'
  }
  if (bits.length === 1) {
    return `${bits[0]} и адрес`
  }
  return bits.join(', ')
}

const SCHEMA_DAY: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

function searchBlurb(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= 160) {
    return clean
  }
  const cut = clean.slice(0, 157).replace(/\s+\S*$/, '').trim()
  return cut.length >= 110 ? cut : clean.slice(0, 160)
}

export interface VenueSeoInput {
  slug: string
  name: string
  kind: string
  description: string
  regionTitle?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  phone?: string | null
  website?: string | null
  priceLevel?: number | null
  cuisine?: string[]
  hours?: Array<{ weekday: string, opens: string | null, closes: string | null, closed?: boolean }>
  seoTitle?: string | null
  seoDescription?: string | null
  noindex?: boolean
  image?: SeoImage | null
}

export function venueDocument(input: VenueSeoInput): SeoDocument {
  const path = `/zavedeniya/${input.slug}`
  const title = intentTitle(input.name, venueIntent(input), input.seoTitle)
  const description = pageDescription(searchBlurb(input.description || input.name), input.seoDescription, [
    input.regionTitle,
    input.address,
  ])
  const crumbs: Crumb[] = [
    { name: 'Главная', href: '/' },
    { name: 'Заведения', href: '/zavedeniya' },
    { name: input.name, href: path },
  ]
  const image = input.image ?? DEFAULT_OG_IMAGE
  const node: Record<string, unknown> = {
    '@type': venueSchemaType(input.kind),
    'name': input.name,
    'description': description,
    'url': absoluteUrl(path),
  }
  if (input.image?.url.trim()) {
    node.image = imageObject(input.image)
  } else if (image.url) {
    node.image = image.url
  }
  const geo = geoNode(input.latitude, input.longitude)
  if (geo) {
    node.geo = geo
  }
  const address = postalAddress(input.address, input.regionTitle)
  if (address) {
    node.address = address
  }
  const phone = input.phone?.trim()
  if (phone) {
    node.telephone = phone
  }
  const website = input.website?.trim()
  if (website?.startsWith('http://') || website?.startsWith('https://')) {
    node.sameAs = [website]
  }
  if (input.priceLevel && input.priceLevel >= 1 && input.priceLevel <= 4) {
    node.priceRange = '₽'.repeat(input.priceLevel)
  }
  const cuisine = (input.cuisine ?? []).map((item) => item.trim()).filter(Boolean)
  if (cuisine.length) {
    node.servesCuisine = cuisine
  }
  const specs = (input.hours ?? []).flatMap((day) => {
    if (day.closed || !day.opens || !day.closes) {
      return []
    }
    const name = SCHEMA_DAY[day.weekday]
    const opens = schemaClock(day.opens)
    const closes = schemaClock(day.closes)
    if (!name || !opens || !closes) {
      return []
    }
    return [{
      '@type': 'OpeningHoursSpecification',
      'dayOfWeek': `https://schema.org/${name}`,
      'opens': opens,
      'closes': closes,
    }]
  })
  if (specs.length) {
    node.openingHoursSpecification = specs
  }
  const missingDescription = !input.description.trim()
  return {
    title,
    description,
    canonical: absoluteUrl(path),
    robots: publicRobots(Boolean(input.noindex) || missingDescription),
    h1: input.name,
    crumbs,
    ogImage: image,
    jsonLd: [breadcrumbNode(crumbs), node],
  }
}

const PUBLIC_DOMAIN_LICENSES = new Set(['pd', 'cc0'])

export function imageCredit(image: Pick<SeoImage, 'author' | 'license'>) {
  const author = image.author?.trim() || ''
  const license = image.license?.trim() || ''
  if (!author && !license) {
    return null
  }
  if (PUBLIC_DOMAIN_LICENSES.has(license)) {
    return { creditText: author || 'Wikimedia Commons' }
  }
  const short = licenseLabel(license)
  const name = author || 'Wikimedia Commons'
  const creditText = short ? `${name}, ${short}` : name
  if (!author) {
    return { creditText }
  }
  return { creditText, copyrightNotice: `© ${author}` }
}

function imageObject(image: SeoImage) {
  const node: Record<string, unknown> = {
    '@type': 'ImageObject',
    'url': image.url,
    'contentUrl': image.url,
  }
  const caption = image.alt.trim()
  if (caption) {
    node.caption = caption
  }
  if (image.width) {
    node.width = image.width
  }
  if (image.height) {
    node.height = image.height
  }
  if (image.author) {
    node.creator = { '@type': 'Person', 'name': image.author }
  }
  const license = licenseHref(image.license)
  if (license) {
    node.license = license
  }
  if (image.sourceUrl) {
    node.acquireLicensePage = image.sourceUrl
  }
  const credit = imageCredit(image)
  if (credit) {
    node.creditText = credit.creditText
    if (credit.copyrightNotice) {
      node.copyrightNotice = credit.copyrightNotice
    }
  }
  return node
}

export interface PlaceSeoInput {
  slug: string
  title: string
  summary: string
  categorySlug: string
  categoryTitle: string
  regionTitle: string | null
  latitude: number | null
  longitude: number | null
  hours: string | null
  price?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  noindex?: boolean
  sources: Array<{ title: string, url: string }>
  image?: SeoImage | null
  images?: SeoImage[]
  page?: number
  body?: string | null
  faq?: Array<{ question: string, answer: string }>
  updatedAt?: string | null
  checkedAt?: string | null
}

// ISO date (YYYY-MM-DD) or null. Accepts a timestamp string from Postgres.
export function isoDay(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(value?.trim() || '')
  if (!match) {
    return null
  }
  const day = `${match[1]}-${match[2]}-${match[3]}`
  return Number.isFinite(Date.parse(day)) ? day : null
}

function placeWebPage(path: string, name: string, description: string, input: { updatedAt?: string | null, checkedAt?: string | null }) {
  const url = absoluteUrl(path)
  const node: Record<string, unknown> = {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    'url': url,
    'name': name,
    'description': description,
    'inLanguage': 'ru',
    'isPartOf': { '@id': `${SITE_ORIGIN}/#website` },
    'about': { '@id': `${url}#place` },
    'author': { '@id': `${SITE_ORIGIN}/#organization` },
    'publisher': { '@id': `${SITE_ORIGIN}/#organization` },
  }
  const modified = isoDay(input.updatedAt)
  if (modified) {
    node.dateModified = modified
  }
  const reviewed = isoDay(input.checkedAt)
  if (reviewed) {
    node.lastReviewed = reviewed
  }
  return node
}

export function placeDocument(input: PlaceSeoInput): SeoDocument {
  const path = `/${input.slug}`
  const page = input.page ?? 1
  const title = intentTitle(input.title, placeIntent(input.hours), input.seoTitle)
  const description = pageDescription(input.summary, input.seoDescription, [
    input.regionTitle,
    input.hours?.trim() ? `Часы: ${input.hours.trim()}.` : '',
  ])
  const crumbs: Crumb[] = [
    { name: 'Главная', href: '/' },
    { name: input.categoryTitle, href: `/${input.categorySlug}` },
    { name: input.title, href: path },
  ]
  const image = input.image ?? DEFAULT_OG_IMAGE
  const photos = (input.images ?? []).filter((item) => item.url.trim())
  const node: Record<string, unknown> = {
    '@type': placeNodeTypes(input.categorySlug),
    '@id': `${absoluteUrl(path)}#place`,
    'name': input.title,
    'description': description,
    'url': absoluteUrl(path),
  }
  if (photos.length) {
    node.image = photos.map((item) => imageObject(item))
  } else if (image.url) {
    node.image = image.url
  }
  const geo = geoNode(input.latitude, input.longitude)
  if (geo) {
    node.geo = geo
  }
  const address = postalAddress(null, input.regionTitle)
  if (address) {
    node.address = address
  }
  const hours = schemaOpeningHours(input.hours)
  if (hours) {
    node.openingHours = hours
  }
  const free = accessibleForFree(input.price)
  if (free != null) {
    node.isAccessibleForFree = free
  }
  const sameAs = input.sources.map((source) => source.url).filter((url) => url.startsWith('http://') || url.startsWith('https://'))
  if (sameAs.length) {
    node.sameAs = sameAs
  }
  const citation = input.sources.flatMap((source) => {
    const name = source.title.trim()
    const url = source.url.trim()
    if (!name || !url) {
      return []
    }
    return [{ '@type': 'CreativeWork', name, url }]
  })
  if (citation.length) {
    node.citation = citation
  }
  const noindex = Boolean(input.noindex) || page > 1
  const jsonLd = [
    breadcrumbNode(crumbs),
    node,
    placeWebPage(path, title, description, input),
    { ...organizationNode(), '@id': `${SITE_ORIGIN}/#organization` },
    { ...websiteNode(), '@id': `${SITE_ORIGIN}/#website` },
  ]
  const faq = faqPageNode(input.body, input.faq)
  if (faq) {
    jsonLd.push(faq)
  }
  return {
    title,
    description,
    canonical: page > 1 ? `${absoluteUrl(path)}?page=${page}` : absoluteUrl(path),
    robots: publicRobots(noindex),
    h1: input.title,
    crumbs,
    ogImage: image,
    jsonLd,
  }
}

// Structured FAQ wins. A «Частые вопросы» section in the body is the fallback for older pages.
export function pageFaq(body: string | null | undefined, structured?: Array<{ question: string, answer: string }> | null) {
  const listed = (structured ?? [])
    .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }))
    .filter((item) => item.question && item.answer)
  return listed.length ? listed : faqFromBody(body || '')
}

export function faqPageNode(body: string | null | undefined, structured?: Array<{ question: string, answer: string }> | null) {
  const faq = pageFaq(body, structured)
  if (!faq.length) {
    return null
  }
  return {
    '@type': 'FAQPage',
    'mainEntity': faq.map((item) => ({
      '@type': 'Question',
      'name': item.question,
      'acceptedAnswer': { '@type': 'Answer', 'text': item.answer },
    })),
  }
}

export function faqFromBody(body: string) {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  let inFaq = false
  const items: Array<{ question: string, answer: string }> = []
  let question = ''
  const answer: string[] = []
  const commit = () => {
    const text = answer.join(' ').trim()
    if (question && text) {
      items.push({ question, answer: text })
    }
    question = ''
    answer.length = 0
  }
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^##[ \t]+Частые вопросы\s*$/.test(trimmed)) {
      commit()
      inFaq = true
      continue
    }
    if (!inFaq) {
      continue
    }
    // A later h2 ends the section. An h3 is a question, the form hub articles use.
    if (/^##[ \t]+/.test(trimmed)) {
      break
    }
    const heading = /^###[ \t]+(\S.*)$/.exec(trimmed)
    if (heading?.[1]) {
      commit()
      question = heading[1].trim()
      continue
    }
    if (!trimmed) {
      continue
    }
    const match = /^\*\*([^*]+)\?\*\*(.*)$/.exec(trimmed)
    if (match?.[1]) {
      commit()
      question = `${match[1].trim()}?`
      const sameLine = match[2]?.trim() ?? ''
      if (sameLine) {
        answer.push(sameLine)
        commit()
      }
      continue
    }
    if (question) {
      answer.push(trimmed)
    }
  }
  commit()
  return items
}

// Pulls a «## Как добраться» section out of a Markdown body. The rest of the body is returned unchanged.
export function splitDirections(body: string) {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex((line) => /^##[ \t]+Как добраться[ \t]*$/.test(line.trim()))
  if (start < 0) {
    return { article: body, directions: '' }
  }
  const rest = lines.slice(start + 1)
  const next = rest.findIndex((line) => /^##[ \t]+\S/.test(line.trim()))
  const section = next < 0 ? rest : rest.slice(0, next)
  const after = next < 0 ? [] : rest.slice(next)
  const article = [...lines.slice(0, start), ...after].join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return { article, directions: section.join('\n').trim() }
}

export function stripRepeatedLead(summary: string, body: string) {
  const lead = summary.replace(/\s+/g, ' ').trim()
  if (!lead) {
    return body
  }
  const normalized = body.replace(/\r\n/g, '\n').trimStart()
  const parts = normalized.split(/\n[ \t]*\n/)
  const firstBlock = parts[0] ?? ''
  const afterBlock = parts.slice(1).join('\n\n')
  const first = firstBlock.replace(/\s+/g, ' ').trim()
  if (first === lead) {
    return afterBlock.trimStart()
  }
  if (!first.startsWith(`${lead} `)) {
    return body
  }
  const rest = first.slice(lead.length).trim()
  const after = afterBlock.trimStart()
  return [rest, after].filter(Boolean).join('\n\n')
}

function tripPlace(item: { name: string, url: string, latitude?: number | null, longitude?: number | null }) {
  const place: Record<string, unknown> = {
    '@type': 'TouristAttraction',
    'name': item.name,
    'url': absoluteUrl(item.url),
  }
  if (typeof item.latitude === 'number' && Number.isFinite(item.latitude) && typeof item.longitude === 'number' && Number.isFinite(item.longitude)) {
    place.geo = {
      '@type': 'GeoCoordinates',
      'latitude': item.latitude,
      'longitude': item.longitude,
    }
  }
  return place
}

export function collectionDocument(input: {
  path: string
  h1: string
  summary: string
  crumbName?: string
  parent?: Crumb
  items: Array<{ name: string, url: string, note?: string | null, latitude?: number | null, longitude?: number | null }>
  seoTitle?: string | null
  seoDescription?: string | null
  noindex?: boolean
  page?: number
  kind: 'CollectionPage' | 'TouristTrip'
  ogImage?: SeoImage
  images?: SeoImage[]
  body?: string | null
}): SeoDocument {
  const page = input.page ?? 1
  const parent = input.parent ?? { name: 'Главная', href: '/' }
  const crumbs: Crumb[] = parent.href === '/'
    ? [{ name: 'Главная', href: '/' }, { name: input.h1, href: input.path }]
    : [{ name: 'Главная', href: '/' }, parent, { name: input.h1, href: input.path }]
  const title = intentTitle(input.h1, collectionIntent(input.crumbName), input.seoTitle)
  const description = pageDescription(input.summary, input.seoDescription)
  const listed = input.items.filter((item) => item.name.trim() && item.url.trim())
  const list: Record<string, unknown> = {
    '@type': 'ItemList',
    'numberOfItems': listed.length,
  }
  if (listed.length) {
    list.itemListElement = listed.map((item, index) => {
      const entry: Record<string, unknown> = {
        '@type': 'ListItem',
        'position': index + 1,
        'name': item.name.trim(),
        'url': absoluteUrl(item.url),
      }
      const note = item.note?.trim()
      if (note) {
        entry.description = note
      }
      if (input.kind === 'TouristTrip') {
        entry.item = tripPlace(item)
      }
      return entry
    })
  }
  const node: Record<string, unknown> = input.kind === 'TouristTrip'
    ? { '@type': 'TouristTrip', 'name': input.h1, 'description': description, 'url': absoluteUrl(input.path), 'itinerary': list }
    : { '@type': 'CollectionPage', 'name': input.h1, 'description': description, 'url': absoluteUrl(input.path), 'mainEntity': list }
  if (input.images?.length) {
    node.image = input.images.map((item) => imageObject(item))
  }
  const noindex = Boolean(input.noindex) || page > 1
  const jsonLd = [breadcrumbNode(crumbs), node]
  const faq = faqPageNode(input.body)
  if (faq) {
    jsonLd.push(faq)
  }
  return {
    title,
    description,
    canonical: page > 1 ? `${absoluteUrl(input.path)}?page=${page}` : absoluteUrl(input.path),
    robots: publicRobots(noindex),
    h1: input.h1,
    crumbs,
    ogImage: input.ogImage ?? DEFAULT_OG_IMAGE,
    jsonLd,
  }
}

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'yclid',
  'ysclid',
  'gclid',
  'fbclid',
])

export function tuneRobots(doc: SeoDocument, query: Record<string, unknown>) {
  const filters = Object.keys(query).filter((key) => {
    if (key === 'page' || TRACKING_PARAMS.has(key)) {
      return false
    }
    const value = query[key]
    return value != null && value !== ''
  })
  if (!filters.length) {
    return doc
  }
  return { ...doc, robots: publicRobots(true) }
}

export function headFromDocument(doc: SeoDocument) {
  return {
    title: doc.title,
    meta: [
      { name: 'description', content: doc.description },
      { name: 'robots', content: doc.robots },
      { name: 'geo.region', content: GEO_REGION },
      { property: 'og:title', content: doc.title },
      { property: 'og:description', content: doc.description },
      { property: 'og:url', content: doc.canonical },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: 'ru_RU' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:image', content: doc.ogImage.url },
      { property: 'og:image:alt', content: doc.ogImage.alt },
      ...(doc.ogImage.width ? [{ property: 'og:image:width', content: String(doc.ogImage.width) }] : []),
      ...(doc.ogImage.height ? [{ property: 'og:image:height', content: String(doc.ogImage.height) }] : []),
      ...(doc.ogImage.type ? [{ property: 'og:image:type' as const, content: doc.ogImage.type }] : []),
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: doc.title },
      { name: 'twitter:description', content: doc.description },
      { name: 'twitter:image', content: doc.ogImage.url },
    ],
    link: [{ rel: 'canonical' as const, href: doc.canonical }],
    script: [{
      type: 'application/ld+json' as const,
      innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@graph': doc.jsonLd }),
    }],
  }
}

export function countH1(html: string) {
  return [...html.matchAll(/<h1\b/gi)].length
}

const SCHEMA_TYPES = new Set([
  'Organization',
  'WebSite',
  'ImageObject',
  'BreadcrumbList',
  'ListItem',
  'TouristAttraction',
  'LandmarksOrHistoricalBuildings',
  'Beach',
  'Museum',
  'TouristTrip',
  'ItemList',
  'CollectionPage',
  'FAQPage',
  'Question',
  'Answer',
  'Restaurant',
  'CafeOrCoffeeShop',
  'LocalBusiness',
  'OpeningHoursSpecification',
  'GeoCoordinates',
  'PostalAddress',
  'Person',
  'CreativeWork',
  'WebPage',
])

const OPENING_HOURS = /^(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))? \d{2}:\d{2}-\d{2}:\d{2}$/

export function jsonLdTypes(node: { '@type'?: unknown }) {
  const value = node['@type']
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
  }
  if (typeof value === 'string' && value) {
    return [value]
  }
  return []
}

export function schemaProblems(nodes: unknown[]) {
  const graph = JSON.parse(JSON.stringify(nodes)) as unknown[]
  const problems: string[] = []
  graph.forEach((node, index) => walkSchema(node, `$${index}`, problems))
  return problems
}

function walkSchema(value: unknown, path: string, problems: string[]) {
  if (value == null) {
    problems.push(`${path} empty`)
    return
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      problems.push(`${path} not finite`)
    }
    return
  }
  if (typeof value === 'boolean') {
    return
  }
  if (typeof value === 'string') {
    if (!value.trim()) {
      problems.push(`${path} blank`)
    }
    return
  }
  if (Array.isArray(value)) {
    if (!value.length) {
      problems.push(`${path} empty list`)
    }
    value.forEach((item, index) => walkSchema(item, `${path}[${index}]`, problems))
    return
  }
  if (typeof value !== 'object') {
    return
  }
  const record = value as Record<string, unknown>
  if (!Object.keys(record).length) {
    problems.push(`${path} empty object`)
    return
  }
  for (const [key, item] of Object.entries(record)) {
    walkSchema(item, `${path}.${key}`, problems)
  }
  const types = jsonLdTypes(record)
  if ('@type' in record && !types.length) {
    problems.push(`${path} @type`)
  }
  for (const type of types) {
    if (!SCHEMA_TYPES.has(type)) {
      problems.push(`${path} type ${type}`)
    }
  }
  if (types.includes('GeoCoordinates')) {
    const latitude = record.latitude
    const longitude = record.longitude
    if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
      problems.push(`${path} latitude`)
    }
    if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
      problems.push(`${path} longitude`)
    }
  }
  if (typeof record.openingHours === 'string' && !OPENING_HOURS.test(record.openingHours)) {
    problems.push(`${path} openingHours`)
  }
  if ('isAccessibleForFree' in record && typeof record.isAccessibleForFree !== 'boolean') {
    problems.push(`${path} isAccessibleForFree`)
  }
  for (const key of ['url', 'contentUrl', 'item', '@id', 'license', 'acquireLicensePage'] as const) {
    const link = record[key]
    if (typeof link === 'string' && !/^https?:\/\//.test(link)) {
      problems.push(`${path}.${key}`)
    }
  }
}
