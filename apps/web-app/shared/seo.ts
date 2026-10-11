export const SITE_ORIGIN = 'https://k39.online'
export const SITE_NAME = 'K39'
export const DEFAULT_OG_IMAGE = {
  url: `${SITE_ORIGIN}/favicon.png`,
  width: 120,
  height: 120,
  alt: 'K39',
}

export const RESERVED_SLUGS = [
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
  'media',
  'muzei',
  'place',
  'plyazhi',
  'podborki',
  'preview',
  'quest',
  'robots',
  'search',
  'sign-in',
  'sitemap',
  'sitemaps',
  'zamki',
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

export function pageTitle(name: string, context: string, override?: string | null) {
  const custom = override?.trim()
  if (custom) {
    return custom.includes(SITE_NAME) ? custom : `${custom} | ${SITE_NAME}`
  }
  const base = context ? `${name} — ${context}` : name
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
  const title = pageTitle('Куда сходить в Калининградской области', '')
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
}

export function placeDocument(input: PlaceSeoInput): SeoDocument {
  const path = `/${input.slug}`
  const page = input.page ?? 1
  const title = pageTitle(input.title, input.categoryTitle, input.seoTitle)
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
    'image': input.images?.length ? input.images.map((item) => item.url) : image.url,
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
  const noindex = Boolean(input.noindex) || page > 1
  return {
    title,
    description,
    canonical: page > 1 ? `${absoluteUrl(path)}?page=${page}` : absoluteUrl(path),
    robots: noindex ? 'noindex, follow' : 'index, follow',
    h1: input.title,
    crumbs,
    ogImage: image,
    jsonLd: [breadcrumbNode(crumbs), node],
  }
}

export function collectionDocument(input: {
  path: string
  h1: string
  summary: string
  crumbName: string
  parent?: Crumb
  items: Array<{ name: string, url: string }>
  seoTitle?: string | null
  seoDescription?: string | null
  noindex?: boolean
  page?: number
  kind: 'CollectionPage' | 'TouristTrip'
  ogImage?: SeoImage
}): SeoDocument {
  const page = input.page ?? 1
  const parent = input.parent ?? { name: 'Главная', href: '/' }
  const crumbs: Crumb[] = parent.href === '/'
    ? [{ name: 'Главная', href: '/' }, { name: input.h1, href: input.path }]
    : [{ name: 'Главная', href: '/' }, parent, { name: input.h1, href: input.path }]
  const title = pageTitle(input.h1, input.crumbName, input.seoTitle)
  const description = metaDescription(input.summary, input.seoDescription)
  const list = {
    '@type': 'ItemList',
    'itemListElement': input.items.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.name,
      'url': absoluteUrl(item.url),
    })),
  }
  const node: Record<string, unknown> = input.kind === 'TouristTrip'
    ? { '@type': 'TouristTrip', 'name': input.h1, 'description': description, 'url': absoluteUrl(input.path), 'itinerary': list }
    : { '@type': 'CollectionPage', 'name': input.h1, 'description': description, 'url': absoluteUrl(input.path), 'mainEntity': list }
  const noindex = Boolean(input.noindex) || page > 1
  return {
    title,
    description,
    canonical: page > 1 ? `${absoluteUrl(input.path)}?page=${page}` : absoluteUrl(input.path),
    robots: noindex ? 'noindex, follow' : 'index, follow',
    h1: input.h1,
    crumbs,
    ogImage: input.ogImage ?? DEFAULT_OG_IMAGE,
    jsonLd: [breadcrumbNode(crumbs), node],
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
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: doc.title },
      { name: 'twitter:description', content: doc.description },
      { name: 'twitter:image', content: doc.ogImage.url },
    ],
    link: [{ rel: 'canonical', href: doc.canonical }],
    script: [{
      type: 'application/ld+json',
      innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@graph': doc.jsonLd }),
    }],
  }
}

export function countH1(html: string) {
  return [...html.matchAll(/<h1\b/gi)].length
}
