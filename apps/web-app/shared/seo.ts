import { licenseHref, licenseLabel } from './media'

export const SITE_ORIGIN = 'https://k39.online'
export const SITE_NAME = 'K39'
export const DEFAULT_OG_IMAGE = {
  url: `${SITE_ORIGIN}/og-default.jpg`,
  width: 1200,
  height: 630,
  alt: 'K39',
  type: 'image/jpeg',
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
  'karta',
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
    robots: 'index, follow',
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
  zamki: 'LandmarksOrHistoricalBuildings',
  plyazhi: 'Beach',
  muzei: 'Museum',
  kurorty: 'TouristAttraction',
  eda: 'TouristAttraction',
}

export function placeSchemaType(categorySlug: string) {
  return SCHEMA_BY_CATEGORY[categorySlug] ?? 'TouristAttraction'
}

const FOOD_SERVICE = new Set(['cafe', 'restaurant', 'coffee', 'bar', 'bakery', 'fastfood'])

export function venueSchemaType(kind: string) {
  return FOOD_SERVICE.has(kind) ? 'Restaurant' : 'LocalBusiness'
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
  const title = pageTitle(input.name, input.seoTitle)
  const description = metaDescription(searchBlurb(input.description || input.name), input.seoDescription)
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
    'image': input.image ? imageObject(input.image) : image.url,
  }
  if (input.latitude != null && input.longitude != null) {
    node.geo = {
      '@type': 'GeoCoordinates',
      'latitude': input.latitude,
      'longitude': input.longitude,
    }
  }
  if (input.address || input.regionTitle) {
    node.address = {
      '@type': 'PostalAddress',
      'streetAddress': input.address || undefined,
      'addressLocality': input.regionTitle || undefined,
      'addressRegion': 'Калининградская область',
      'addressCountry': 'RU',
    }
  }
  if (input.phone) {
    node.telephone = input.phone
  }
  if (input.website) {
    node.sameAs = [input.website]
  }
  if (input.priceLevel) {
    node.priceRange = '₽'.repeat(Math.min(4, input.priceLevel))
  }
  if (input.cuisine?.length) {
    node.servesCuisine = input.cuisine
  }
  const specs = (input.hours ?? []).flatMap((day) => {
    if (day.closed || !day.opens || !day.closes) {
      return []
    }
    const name = SCHEMA_DAY[day.weekday]
    if (!name) {
      return []
    }
    return [{
      '@type': 'OpeningHoursSpecification',
      'dayOfWeek': `https://schema.org/${name}`,
      'opens': day.opens,
      'closes': day.closes === '24:00' ? '23:59' : day.closes,
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
    robots: input.noindex || missingDescription ? 'noindex, follow' : 'index, follow',
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
    'caption': image.alt,
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
  seoTitle?: string | null
  seoDescription?: string | null
  noindex?: boolean
  sources: Array<{ title: string, url: string }>
  image?: SeoImage | null
  images?: SeoImage[]
  page?: number
  body?: string | null
}

export function placeDocument(input: PlaceSeoInput): SeoDocument {
  const path = `/${input.slug}`
  const page = input.page ?? 1
  const title = pageTitle(input.title, input.seoTitle)
  const description = metaDescription(input.summary, input.seoDescription)
  const crumbs: Crumb[] = [
    { name: 'Главная', href: '/' },
    { name: input.categoryTitle, href: `/${input.categorySlug}` },
    { name: input.title, href: path },
  ]
  const image = input.image ?? DEFAULT_OG_IMAGE
  const node: Record<string, unknown> = {
    '@type': placeSchemaType(input.categorySlug),
    'name': input.title,
    'description': description,
    'url': absoluteUrl(path),
    'image': input.images?.length ? input.images.map((item) => imageObject(item)) : image.url,
  }
  if (input.latitude != null && input.longitude != null) {
    node.geo = {
      '@type': 'GeoCoordinates',
      'latitude': input.latitude,
      'longitude': input.longitude,
    }
  }
  if (input.regionTitle) {
    node.address = {
      '@type': 'PostalAddress',
      'addressLocality': input.regionTitle,
      'addressRegion': 'Калининградская область',
      'addressCountry': 'RU',
    }
  }
  const sameAs = input.sources.map((source) => source.url).filter((url) => url.startsWith('http'))
  if (sameAs.length) {
    node.sameAs = sameAs
  }
  if (input.sources.length) {
    node.citation = input.sources.map((source) => ({
      '@type': 'CreativeWork',
      'name': source.title,
      'url': source.url,
    }))
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
    canonical: page > 1 ? `${absoluteUrl(path)}?page=${page}` : absoluteUrl(path),
    robots: noindex ? 'noindex, follow' : 'index, follow',
    h1: input.title,
    crumbs,
    ogImage: image,
    jsonLd,
  }
}

export function faqPageNode(body: string | null | undefined) {
  const faq = faqFromBody(body || '')
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
  const title = pageTitle(input.h1, input.seoTitle)
  const description = metaDescription(input.summary, input.seoDescription)
  const list = {
    '@type': 'ItemList',
    'numberOfItems': input.items.length,
    'itemListElement': input.items.map((item, index) => {
      const entry: Record<string, unknown> = {
        '@type': 'ListItem',
        'position': index + 1,
        'name': item.name,
        'url': absoluteUrl(item.url),
      }
      if (item.note) {
        entry.description = item.note
      }
      if (input.kind === 'TouristTrip') {
        entry.item = tripPlace(item)
      }
      return entry
    }),
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
    robots: noindex ? 'noindex, follow' : 'index, follow',
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
  return { ...doc, robots: 'noindex, follow' }
}

export function headFromDocument(doc: SeoDocument) {
  return {
    title: doc.title,
    meta: [
      { name: 'description', content: doc.description },
      { name: 'robots', content: doc.robots },
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
