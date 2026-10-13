import { articleBody } from './address'
import { haversineKm, HUBS, SECTION_LINKS } from './links'
import { absoluteUrl, collectionDocument, faqFromBody, jsonLdTypes, placeDocument, placeSchemaType, venueDocument, venueSchemaType } from './seo'

export type PageKind = 'place' | 'route' | 'collection' | 'hub' | 'quest' | 'venue'
export type PrimaryAction = 'build_route' | 'buy_ticket' | 'go_next_place' | 'claim_offer' | 'read'
export type ScoreBlock = 'quality' | 'linking' | 'indexing' | 'results'

export const MAJOR_PLACE_CATEGORIES = new Set(['forty', 'zamki'])
export const FRESH_DAYS = 180

const CHROME = [...HUBS.map((link) => link.href), ...SECTION_LINKS.map((link) => link.href)]

export interface ScoreChecks {
  quality: string[]
  linking: string[]
  indexing: string[]
  results: string[]
}

export interface PassportFields {
  targetQueries: string[]
  audience: string | null
  primaryAction: PrimaryAction | null
  goal30d: number | null
  goal90d: number | null
  notes: string | null
}

export interface ResultInput {
  organic7d: number
  organic30d: number
  organic90d: number
  searchImported: boolean
  queries: string[]
  pageviews30d: number
  scrollMax: number | null
  avgEngagedSec: number | null
  engagedTracked: boolean
  scrollTracked: boolean
  nextClicks: number
}

export interface ScoreSource {
  kind: PageKind
  id: string
  path: string
  title: string
  summary: string
  body: string
  howToGet: string | null
  hours: string | null
  price: string | null
  categorySlug: string | null
  categoryTitle: string | null
  regionTitle: string | null
  latitude: number | null
  longitude: number | null
  sources: Array<{ title: string, url: string }>
  publicationStatus: 'draft' | 'review' | 'published'
  noindex: boolean
  seoTitle: string | null
  seoDescription: string | null
  factsCheckedAt: string | null
  // Collection stops only. city is the place region id. access is the item note plus the place address.
  stops?: Array<{ city: string | null, access: string | null }>
  photoCount: number
  inRoute: boolean
  inCollection: boolean
  memberCount: number
  inbound: number
  contentOutbound: number
  orphan: boolean
  passport: PassportFields | null
  indexingHooks?: { yandex: boolean | null, google: boolean | null }
  results: ResultInput
}

export interface PageScore {
  pageType: PageKind
  entityId: string
  path: string
  title: string
  total: number
  quality: number
  linking: number
  indexing: number
  results: number
  checks: ScoreChecks
  signals: Record<string, unknown>
  organic30d: number
  organic90d: number
  goal30d: number | null
  goal90d: number | null
}

export interface LinkPlace {
  slug: string
  title: string
  categorySlug: string | null
  regionId: string | null
  latitude: number | null
  longitude: number | null
  published: boolean
  noindex: boolean
  body: string
}

export interface LinkGroup {
  slug: string
  title: string
  published: boolean
  noindex: boolean
  placeSlugs: string[]
  body: string
}

export interface LinkVenue {
  slug: string
  published: boolean
  noindex: boolean
  regionSlug: string | null
  latitude: number | null
  longitude: number | null
}

export interface LinkCatalog {
  places: LinkPlace[]
  routes: LinkGroup[]
  collections: LinkGroup[]
  quests: Array<LinkGroup & { routeSlug: string | null }>
  hubs: Array<{ slug: string, title: string, description: string, body: string, noindex: boolean }>
  venues?: LinkVenue[]
  related: Array<{ fromSlug: string, toSlug: string }>
}

export interface LinkStat {
  inbound: number
  contentOutbound: number
  orphan: boolean
}

export function emptyResults(): ResultInput {
  return {
    organic7d: 0,
    organic30d: 0,
    organic90d: 0,
    searchImported: false,
    queries: [],
    pageviews30d: 0,
    scrollMax: null,
    avgEngagedSec: null,
    engagedTracked: false,
    scrollTracked: false,
    nextClicks: 0,
  }
}

export function lengthNorm(kind: PageKind, categorySlug: string | null) {
  if (kind === 'place') {
    return MAJOR_PLACE_CATEGORIES.has(categorySlug || '')
      ? { min: 3000, max: 6000 as number | null }
      : { min: 2000, max: null }
  }
  if (kind === 'route') {
    return { min: 8000, max: 12000 as number | null }
  }
  if (kind === 'collection') {
    return { min: 5000, max: 8000 as number | null }
  }
  if (kind === 'quest') {
    return { min: 2000, max: 4000 as number | null }
  }
  // Hub landing pages have a floor and no ceiling. Six FAQ questions are scored on their own.
  return { min: 2000, max: null }
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function unique(paths: string[]) {
  return [...new Set(paths.filter((path) => path.startsWith('/')))]
}

export function internalPath(href: string) {
  const raw = href.trim()
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) {
    return null
  }
  let path = ''
  if (raw.startsWith('/')) {
    path = raw.split('?')[0]?.split('#')[0] || '/'
  } else {
    try {
      const url = new URL(raw)
      if (url.hostname !== 'k39.online' && url.hostname !== 'www.k39.online') {
        return null
      }
      path = url.pathname || '/'
    } catch {
      return null
    }
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1)
  }
  return path || null
}

export function markdownInternalPaths(markdown: string) {
  const found: string[] = []
  const pattern = /\[[^\]]*\]\(([^)\s]+)\)/g
  for (const match of markdown.matchAll(pattern)) {
    const path = internalPath(match[1] || '')
    if (path) {
      found.push(path)
    }
  }
  return unique(found)
}

function publishedPlaceSet(catalog: LinkCatalog) {
  return new Set(catalog.places.filter((place) => place.published).map((place) => place.slug))
}

function contentLinks(path: string, catalog: LinkCatalog) {
  const live = publishedPlaceSet(catalog)
  const links: string[] = []
  const place = catalog.places.find((item) => `/${item.slug}` === path)
  if (place) {
    if (place.categorySlug) {
      links.push(`/${place.categorySlug}`)
    }
    if (place.latitude != null && place.longitude != null) {
      const nearest = catalog.places
        .filter((item) => item.published && item.slug !== place.slug && item.latitude != null && item.longitude != null)
        .map((item) => ({
          path: `/${item.slug}`,
          distance: haversineKm(place.latitude!, place.longitude!, item.latitude!, item.longitude!),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 6)
      links.push(...nearest.map((item) => item.path))
    }
    if (place.regionId) {
      const region = catalog.places
        .filter((item) => item.published && item.slug !== place.slug && item.regionId === place.regionId)
        .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
        .slice(0, 6)
      links.push(...region.map((item) => `/${item.slug}`))
    }
    for (const route of catalog.routes) {
      if (route.published && route.placeSlugs.includes(place.slug)) {
        links.push(`/marshruty/${route.slug}`)
      }
    }
    for (const collection of catalog.collections) {
      if (collection.published && collection.placeSlugs.includes(place.slug)) {
        links.push(`/podborki/${collection.slug}`)
      }
    }
    for (const link of catalog.related) {
      if (link.fromSlug === place.slug && live.has(link.toSlug)) {
        links.push(`/${link.toSlug}`)
      }
    }
    links.push(...markdownInternalPaths(place.body))
  }
  const route = catalog.routes.find((item) => `/marshruty/${item.slug}` === path)
  if (route) {
    links.push('/marshruty')
    links.push(...route.placeSlugs.filter((slug) => live.has(slug)).map((slug) => `/${slug}`))
    links.push(...markdownInternalPaths(route.body))
  }
  const collection = catalog.collections.find((item) => `/podborki/${item.slug}` === path)
  if (collection) {
    links.push('/podborki')
    links.push(...collection.placeSlugs.filter((slug) => live.has(slug)).map((slug) => `/${slug}`))
    links.push(...markdownInternalPaths(collection.body))
  }
  const quest = catalog.quests.find((item) => `/kvesty/${item.slug}` === path)
  if (quest) {
    links.push('/kvesty')
    links.push(...quest.placeSlugs.filter((slug) => live.has(slug)).map((slug) => `/${slug}`))
    if (quest.routeSlug && catalog.routes.some((item) => item.published && item.slug === quest.routeSlug)) {
      links.push(`/marshruty/${quest.routeSlug}`)
    }
    links.push(...markdownInternalPaths(quest.body))
  }
  const hub = catalog.hubs.find((item) => `/${item.slug}` === path)
  if (hub) {
    links.push(...catalog.places.filter((item) => item.published && item.categorySlug === hub.slug).map((item) => `/${item.slug}`))
    if (hub.slug === 'forty') {
      links.push(...catalog.routes.filter((item) => item.published).map((item) => `/marshruty/${item.slug}`))
    }
    links.push(...markdownInternalPaths(hub.body))
    links.push(...markdownInternalPaths(hub.description))
  }
  if (path === '/marshruty') {
    links.push(...catalog.routes.filter((item) => item.published).map((item) => `/marshruty/${item.slug}`))
  }
  if (path === '/podborki') {
    links.push(...catalog.collections.filter((item) => item.published).map((item) => `/podborki/${item.slug}`))
  }
  if (path === '/kvesty') {
    links.push(...catalog.quests.filter((item) => item.published).map((item) => `/kvesty/${item.slug}`))
  }
  const venues = catalog.venues ?? []
  if (path === '/zavedeniya') {
    links.push(...venues.filter((item) => item.published && !item.noindex).map((item) => `/zavedeniya/${item.slug}`))
  }
  const venue = venues.find((item) => `/zavedeniya/${item.slug}` === path)
  if (venue) {
    links.push('/zavedeniya')
    if (venue.regionSlug) {
      links.push(`/zavedeniya/${venue.regionSlug}`)
    }
    if (venue.latitude != null && venue.longitude != null) {
      const nearest = catalog.places
        .filter((item) => item.published && item.latitude != null && item.longitude != null)
        .map((item) => ({
          path: `/${item.slug}`,
          distance: haversineKm(venue.latitude!, venue.longitude!, item.latitude!, item.longitude!),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 4)
      links.push(...nearest.map((item) => item.path))
    }
  }
  if (path === '/') {
    const featured = catalog.places
      .filter((item) => item.published && item.categorySlug === 'forty')
      .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
      .slice(0, 6)
    links.push(...featured.map((item) => `/${item.slug}`))
    const firstRoute = catalog.routes.filter((item) => item.published).sort((a, b) => a.title.localeCompare(b.title, 'ru'))[0]
    const firstQuest = catalog.quests.filter((item) => item.published).sort((a, b) => a.title.localeCompare(b.title, 'ru'))[0]
    if (firstRoute) {
      links.push(`/marshruty/${firstRoute.slug}`)
    }
    if (firstQuest) {
      links.push(`/kvesty/${firstQuest.slug}`)
    }
  }
  return unique(links.filter((href) => href !== path))
}

export function linkStats(catalog: LinkCatalog) {
  const scored = [
    ...catalog.places.map((item) => ({ path: `/${item.slug}`, published: item.published, noindex: item.noindex })),
    ...catalog.routes.map((item) => ({ path: `/marshruty/${item.slug}`, published: item.published, noindex: item.noindex })),
    ...catalog.collections.map((item) => ({ path: `/podborki/${item.slug}`, published: item.published, noindex: item.noindex })),
    ...catalog.quests.map((item) => ({ path: `/kvesty/${item.slug}`, published: item.published, noindex: item.noindex })),
    ...catalog.hubs.map((item) => ({ path: `/${item.slug}`, published: true, noindex: item.noindex })),
    ...(catalog.venues ?? []).map((item) => ({ path: `/zavedeniya/${item.slug}`, published: item.published, noindex: item.noindex })),
  ]
  const sources = [
    '/',
    '/marshruty',
    '/podborki',
    '/kvesty',
    ...catalog.hubs.map((item) => `/${item.slug}`),
    ...catalog.places.filter((item) => item.published).map((item) => `/${item.slug}`),
    ...catalog.routes.filter((item) => item.published).map((item) => `/marshruty/${item.slug}`),
    ...catalog.collections.filter((item) => item.published).map((item) => `/podborki/${item.slug}`),
    ...catalog.quests.filter((item) => item.published).map((item) => `/kvesty/${item.slug}`),
    '/zavedeniya',
    ...(catalog.venues ?? []).filter((item) => item.published).map((item) => `/zavedeniya/${item.slug}`),
  ]
  const inbound = new Map<string, Set<string>>()
  for (const source of sources) {
    const outbound = unique([...CHROME, ...contentLinks(source, catalog)]).filter((href) => href !== source)
    for (const href of outbound) {
      const row = inbound.get(href) ?? new Set<string>()
      row.add(source)
      inbound.set(href, row)
    }
  }
  const stats = new Map<string, LinkStat>()
  for (const page of scored) {
    const count = inbound.get(page.path)?.size ?? 0
    stats.set(page.path, {
      inbound: count,
      contentOutbound: contentLinks(page.path, catalog).length,
      orphan: page.published && !page.noindex && count === 0,
    })
  }
  return stats
}

function articleText(page: Pick<ScoreSource, 'kind' | 'summary' | 'body' | 'howToGet'>) {
  if (page.kind === 'hub') {
    return page.body.trim()
  }
  if (page.kind === 'place') {
    return articleBody(page.summary, page.body, page.howToGet).trim()
  }
  return page.body.trim()
}

function markdownHeadings(text: string) {
  return [...text.replace(/\r\n/g, '\n').matchAll(/^#{2,3}[ \t]+(\S.*)$/gm)].map((match) => match[1]?.trim() ?? '')
}

// Route and collection articles use these headings instead of one exact line.
const NOT_CYRILLIC = String.raw`\P{Script=Cyrillic}`
const DIRECTION_HEADING = new RegExp(`как добраться|(?:^|${NOT_CYRILLIC})дорог[аеиу](?!\\p{Script=Cyrillic})|транспорт|без машины|как (?:ехать|доехать|передвигаться)|на машине`, 'iu')
const PRICE_HEADING = new RegExp(`цены|цена|стоимость|режим работы|практическая информация|(?:^|${NOT_CYRILLIC})билеты?(?!\\p{Script=Cyrillic})|бюджет|сколько стоит|стоит денег`, 'iu')
const PRICE_AMOUNT = /₽|руб(?:\.|лей|ля|ль|ли)?(?!\p{Script=Cyrillic})/iu

function hasDirections(text: string, howToGet: string | null) {
  if (howToGet?.trim()) {
    return true
  }
  return markdownHeadings(text).some((heading) => DIRECTION_HEADING.test(heading))
}

const ACCESS_LINE = /ул\.|улиц|проспект|пр-т|(?:^|[^\p{L}])пр\.|площад|переул|шоссе|набережн|автобус|трамва|электричка|поезд|такси|маршрутка|пешком|остановк|транспорт|как добраться/iu

function accessLine(value: string | null | undefined) {
  return ACCESS_LINE.test(value?.trim() ?? '')
}

function sameCity(stops: Array<{ city: string | null }>) {
  const city = stops[0]?.city?.trim()
  return Boolean(city) && stops.every((stop) => stop.city?.trim() === city)
}

function collectionDirections(page: ScoreSource, text: string) {
  if (hasDirections(text, null)) {
    return true
  }
  const stops = page.stops ?? []
  if (!stops.length) {
    return false
  }
  // A city collection does not need one how-to-get block. Per-stop address or transport also covers it.
  return sameCity(stops) || stops.every((stop) => accessLine(stop.access))
}

function hasPractical(text: string, hours: string | null, price: string | null) {
  if (hours?.trim() || price?.trim()) {
    return true
  }
  if (markdownHeadings(text).some((heading) => PRICE_HEADING.test(heading))) {
    return true
  }
  return PRICE_AMOUNT.test(text)
}

function lengthPoints(length: number, norm: { min: number, max: number | null }) {
  if (norm.max != null && length > norm.max) {
    return { points: 18, checks: [`body ${length} chars, above ${norm.max}`] }
  }
  if (length >= norm.min) {
    return { points: 25, checks: [] as string[] }
  }
  const need = norm.max != null ? `${norm.min}-${norm.max}` : String(norm.min)
  return { points: Math.round(25 * length / norm.min), checks: [`body ${length} chars, need ${need}`] }
}

function faqSection(text: string) {
  const questions = faqFromBody(text).length
  if (questions >= 6) {
    return { points: 10, checks: [] as string[], questions }
  }
  if (questions === 0) {
    return { points: 0, checks: ['no FAQ'], questions }
  }
  return { points: 0, checks: [`FAQ ${questions}, need 6`], questions }
}

function sectionPoints(page: ScoreSource, text: string) {
  const faq = faqSection(text)
  // Hubs are lists. Directions and prices stay optional; the article FAQ still counts.
  if (page.kind === 'hub') {
    return { points: 20 + faq.points, checks: faq.checks, questions: faq.questions }
  }
  const checks: string[] = []
  let points = 0
  const directions = page.kind === 'collection'
    ? collectionDirections(page, text)
    : hasDirections(text, page.kind === 'place' ? page.howToGet : null)
  if (directions) {
    points += 10
  } else {
    checks.push('no Как добраться')
  }
  if (hasPractical(text, page.kind === 'place' ? page.hours : null, page.kind === 'place' ? page.price : null)) {
    points += 10
  } else {
    checks.push('no prices')
  }
  return { points: points + faq.points, checks: [...checks, ...faq.checks], questions: faq.questions }
}

function photoNeed(page: ScoreSource) {
  if (page.kind === 'place' && MAJOR_PLACE_CATEGORIES.has(page.categorySlug || '')) {
    return 3
  }
  return 1
}

function photoPoints(page: ScoreSource) {
  const need = photoNeed(page)
  if (page.photoCount >= need) {
    return { points: 15, checks: [] as string[] }
  }
  const points = Math.round(15 * page.photoCount / need)
  const checks = [page.photoCount === 0 ? '0 photos' : `${page.photoCount} photo${page.photoCount === 1 ? '' : 's'}, need ${need}`]
  return { points, checks }
}

function ageDays(value: string | null, now: Date) {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000)
}

function freshPoints(page: ScoreSource, now: Date) {
  const age = ageDays(page.factsCheckedAt, now)
  if (age == null) {
    return { points: 0, checks: ['facts not checked'], age: null as number | null }
  }
  if (age <= FRESH_DAYS) {
    return { points: 15, checks: [] as string[], age }
  }
  return { points: 0, checks: [`facts checked ${age} days ago`], age }
}

function passportPoints(passport: PassportFields | null) {
  const empty = !passport
    || (
      passport.targetQueries.every((query) => !query.trim())
      && !passport.audience?.trim()
      && !passport.primaryAction
      && passport.goal30d == null
      && passport.goal90d == null
    )
  if (empty) {
    return { points: 0, checks: ['passport empty'] }
  }
  const checks: string[] = []
  let points = 0
  if (passport!.targetQueries.some((query) => query.trim())) {
    points += 3
  } else {
    checks.push('no target queries')
  }
  if (passport!.audience?.trim()) {
    points += 3
  } else {
    checks.push('no audience')
  }
  if (passport!.primaryAction) {
    points += 3
  } else {
    checks.push('no action')
  }
  if (passport!.goal30d != null) {
    points += 3
  } else {
    checks.push('no 30-day goal')
  }
  if (passport!.goal90d != null) {
    points += 3
  } else {
    checks.push('no 90-day goal')
  }
  return { points, checks }
}

function membershipPoints(page: ScoreSource) {
  if (page.kind === 'venue') {
    return { points: 30, checks: [] as string[] }
  }
  if (page.kind === 'place') {
    if (page.inRoute || page.inCollection) {
      return { points: 30, checks: [] as string[] }
    }
    return { points: 0, checks: ['not in a route or collection'] }
  }
  if (page.memberCount >= 2 || (page.kind === 'hub' && page.memberCount >= 1)) {
    return { points: 30, checks: [] as string[] }
  }
  if (page.kind === 'hub') {
    return { points: 0, checks: ['empty hub'] }
  }
  if (page.memberCount === 0) {
    const noun = page.kind === 'route' ? 'stops' : page.kind === 'collection' ? 'items' : 'steps'
    return { points: 0, checks: [`no ${noun}`] }
  }
  const noun = page.kind === 'route' ? 'stops' : page.kind === 'collection' ? 'items' : 'steps'
  return { points: 15, checks: [`few ${noun}`] }
}

function linkingPoints(page: ScoreSource) {
  const checks: string[] = []
  let inboundPoints = 40
  if (page.orphan) {
    inboundPoints = 0
    checks.push('orphan')
  } else if (page.inbound === 0) {
    inboundPoints = 0
    checks.push('no inbound')
  } else if (page.inbound === 1) {
    inboundPoints = 20
    checks.push('inbound 1')
  }
  let outboundPoints = 30
  if (page.contentOutbound === 0) {
    outboundPoints = 0
    checks.push('no outbound')
  } else if (page.contentOutbound < 3) {
    outboundPoints = 15
    checks.push(`outbound ${page.contentOutbound}`)
  }
  const membership = membershipPoints(page)
  return {
    points: clamp(inboundPoints + outboundPoints + membership.points),
    checks: [...checks, ...membership.checks],
  }
}

function venueQuality(page: ScoreSource, now: Date) {
  const checks: string[] = []
  let points = 0
  const length = page.body.trim().length
  if (length >= 300 && length <= 600) {
    points += 25
  } else if (length === 0) {
    checks.push('description missing')
  } else {
    checks.push(`description ${length} chars, need 300-600`)
  }
  if (page.photoCount >= 1) {
    points += 15
  } else {
    checks.push('0 photos')
  }
  if (page.hours?.trim()) {
    points += 15
  } else {
    checks.push('no hours')
  }
  const fresh = freshPoints(page, now)
  points += fresh.points
  checks.push(...fresh.checks)
  if (page.latitude != null && page.longitude != null) {
    points += 15
  } else {
    checks.push('no coordinates')
  }
  const passport = passportPoints(page.passport)
  points += passport.points
  checks.push(...passport.checks)
  return { points: clamp(points), checks, age: fresh.age, length }
}

function rendered(page: ScoreSource) {
  if (page.kind === 'venue') {
    return venueDocument({
      slug: page.path.split('/').pop() || page.id,
      name: page.title,
      kind: page.categorySlug || 'other',
      description: page.body,
      regionTitle: page.regionTitle,
      latitude: page.latitude,
      longitude: page.longitude,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      noindex: page.noindex,
    })
  }
  if (page.kind === 'place') {
    const doc = placeDocument({
      slug: page.path.slice(1),
      title: page.title,
      summary: page.summary,
      categorySlug: page.categorySlug || 'place',
      categoryTitle: page.categoryTitle || 'Раздел',
      regionTitle: page.regionTitle,
      latitude: page.latitude,
      longitude: page.longitude,
      hours: page.hours,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      noindex: page.noindex,
      sources: page.sources,
      body: articleText(page),
    })
    return doc
  }
  const parents: Record<string, { name: string, href: string, crumb: string, kind: 'CollectionPage' | 'TouristTrip' }> = {
    route: { name: 'Маршруты', href: '/marshruty', crumb: 'маршрут', kind: 'TouristTrip' },
    collection: { name: 'Подборки', href: '/podborki', crumb: 'подборка', kind: 'CollectionPage' },
    quest: { name: 'Квесты', href: '/kvesty', crumb: 'квест', kind: 'TouristTrip' },
    hub: { name: 'Главная', href: '/', crumb: 'раздел', kind: 'CollectionPage' },
  }
  const parent = parents[page.kind]!
  return collectionDocument({
    path: page.path,
    h1: page.title,
    summary: page.summary || page.title,
    crumbName: parent.crumb,
    parent: page.kind === 'hub' ? undefined : { name: parent.name, href: parent.href },
    items: [],
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    noindex: page.noindex,
    kind: parent.kind,
    body: page.kind === 'quest' ? null : page.body,
  })
}

function expectedTypes(page: ScoreSource) {
  if (page.kind === 'venue') {
    return ['BreadcrumbList', venueSchemaType(page.categorySlug || 'other')]
  }
  if (page.kind === 'place') {
    return ['BreadcrumbList', placeSchemaType(page.categorySlug || '')]
  }
  if (page.kind === 'route' || page.kind === 'quest') {
    return ['BreadcrumbList', 'TouristTrip']
  }
  return ['BreadcrumbList', 'CollectionPage']
}

function httpStatus(page: ScoreSource) {
  if (page.kind === 'hub') {
    return 200
  }
  if (page.kind === 'place' && !page.categorySlug) {
    return 404
  }
  return page.publicationStatus === 'published' ? 200 : 404
}

function listedInSitemap(page: ScoreSource) {
  if (page.noindex) {
    return false
  }
  if (page.kind === 'hub') {
    return true
  }
  if (page.kind === 'place' && !page.categorySlug) {
    return false
  }
  return page.publicationStatus === 'published'
}

function indexingPoints(page: ScoreSource) {
  const doc = rendered(page)
  const checks: string[] = []
  let points = 0
  const sitemap = listedInSitemap(page)
  const status = httpStatus(page)
  if (sitemap && !page.noindex) {
    points += 20
  } else {
    if (page.noindex) {
      checks.push('noindex')
    }
    if (!sitemap) {
      checks.push('not in sitemap')
    }
  }
  if (status === 200) {
    points += 20
  } else {
    checks.push('not 200')
  }
  const types = doc.jsonLd.flatMap((node) => jsonLdTypes(node))
  const missing = expectedTypes(page).filter((type) => !types.includes(type))
  if (!missing.length) {
    points += 20
  } else {
    checks.push(...missing.map((type) => `no ${type}`))
  }
  if (doc.title.length >= 30 && doc.title.length <= 65) {
    points += 15
  } else {
    checks.push(`title ${doc.title.length} chars`)
  }
  if (doc.description.length >= 110 && doc.description.length <= 160) {
    points += 15
  } else {
    checks.push(`description ${doc.description.length} chars`)
  }
  const canonical = absoluteUrl(page.path)
  if (!doc.canonical) {
    checks.push('no canonical')
  } else if (doc.canonical !== canonical) {
    checks.push(`canonical ${doc.canonical}`)
  } else {
    points += 10
  }
  const hooks = page.indexingHooks ?? { yandex: null, google: null }
  if (hooks.yandex === false) {
    checks.push('not in Yandex')
    points -= 10
  }
  if (hooks.google === false) {
    checks.push('not in Google')
    points -= 10
  }
  return {
    points: clamp(points),
    checks,
    types,
    title: doc.title,
    description: doc.description,
    canonical: doc.canonical,
    status,
    sitemap,
    hooks,
  }
}

function goalPoints(actual: number, goal: number | null, weight: number, label: string) {
  if (goal == null || actual >= goal) {
    return { points: weight, checks: [] as string[] }
  }
  return {
    points: Math.round(weight * actual / Math.max(goal, 1)),
    checks: [`${label}: ${actual}, goal ${goal}`],
  }
}

function resultsPoints(page: ScoreSource) {
  const row = page.results
  const checks: string[] = []
  const month = goalPoints(row.organic30d, page.passport?.goal30d ?? null, 35, 'organic 30d')
  const quarter = goalPoints(row.organic90d, page.passport?.goal90d ?? null, 25, 'organic 90d')
  checks.push(...month.checks, ...quarter.checks)
  let queryPoints = 15
  if (row.searchImported && !row.queries.length) {
    queryPoints = 0
    checks.push('no search queries')
  }
  let engagement = 15
  if (row.pageviews30d > 0) {
    if (!row.scrollTracked) {
      engagement -= 5
      checks.push('scroll not tracked')
    } else if ((row.scrollMax ?? 0) < 50) {
      engagement -= 5
      checks.push(`scroll ${row.scrollMax ?? 0}`)
    }
    if (!row.engagedTracked) {
      engagement -= 5
      checks.push('engaged time not tracked')
    } else if ((row.avgEngagedSec ?? 0) < 15) {
      engagement -= 5
      checks.push(`engaged ${Math.round(row.avgEngagedSec ?? 0)}s`)
    }
  }
  let next = 10
  if (row.pageviews30d > 0 && row.nextClicks <= 0) {
    next = 0
    checks.push('no clicks to the next page')
  }
  return { points: clamp(month.points + quarter.points + queryPoints + engagement + next), checks }
}

export function scorePage(page: ScoreSource, now = new Date()): PageScore {
  if (page.kind === 'venue') {
    const quality = venueQuality(page, now)
    const linking = linkingPoints(page)
    const indexing = indexingPoints(page)
    const results = resultsPoints(page)
    const checks: ScoreChecks = {
      quality: quality.checks,
      linking: linking.checks,
      indexing: indexing.checks,
      results: results.checks,
    }
    const blocks = { quality: quality.points, linking: linking.points, indexing: indexing.points, results: results.points }
    return {
      pageType: page.kind,
      entityId: page.id,
      path: page.path,
      title: page.title,
      total: clamp((blocks.quality + blocks.linking + blocks.indexing + blocks.results) / 4),
      quality: blocks.quality,
      linking: blocks.linking,
      indexing: blocks.indexing,
      results: blocks.results,
      checks,
      signals: {
        bodyChars: quality.length,
        tier: null,
        faqCount: 0,
        photoCount: page.photoCount,
        factsAgeDays: quality.age,
        inbound: page.inbound,
        outbound: page.contentOutbound,
        orphan: page.orphan,
        httpStatus: indexing.status,
        inSitemap: indexing.sitemap,
        jsonLdTypes: indexing.types,
        titleLength: indexing.title.length,
        descriptionLength: indexing.description.length,
        yandexIndexed: indexing.hooks.yandex,
        googleIndexed: indexing.hooks.google,
        organic7d: page.results.organic7d,
        organic30d: page.results.organic30d,
        organic90d: page.results.organic90d,
        goal30d: page.passport?.goal30d ?? null,
        goal90d: page.passport?.goal90d ?? null,
        queries: page.results.queries,
        searchImported: page.results.searchImported,
        scrollMax: page.results.scrollMax,
        avgEngagedSec: page.results.avgEngagedSec,
        nextClicks: page.results.nextClicks,
        pageviews30d: page.results.pageviews30d,
      },
      organic30d: page.results.organic30d,
      organic90d: page.results.organic90d,
      goal30d: page.passport?.goal30d ?? null,
      goal90d: page.passport?.goal90d ?? null,
    }
  }
  const text = articleText(page)
  const length = lengthPoints(text.length, lengthNorm(page.kind, page.categorySlug))
  const sections = sectionPoints(page, text)
  const photos = photoPoints(page)
  const fresh = freshPoints(page, now)
  const passport = passportPoints(page.passport)
  const quality = clamp(length.points + sections.points + photos.points + fresh.points + passport.points)
  const linking = linkingPoints(page)
  const indexing = indexingPoints(page)
  const results = resultsPoints(page)
  const checks: ScoreChecks = {
    quality: [...length.checks, ...sections.checks, ...photos.checks, ...fresh.checks, ...passport.checks],
    linking: linking.checks,
    indexing: indexing.checks,
    results: results.checks,
  }
  const blocks = { quality, linking: linking.points, indexing: indexing.points, results: results.points }
  return {
    pageType: page.kind,
    entityId: page.id,
    path: page.path,
    title: page.title,
    total: clamp((blocks.quality + blocks.linking + blocks.indexing + blocks.results) / 4),
    quality: blocks.quality,
    linking: blocks.linking,
    indexing: blocks.indexing,
    results: blocks.results,
    checks,
    signals: {
      bodyChars: text.length,
      tier: page.kind === 'place' ? (MAJOR_PLACE_CATEGORIES.has(page.categorySlug || '') ? 'major' : 'minor') : null,
      faqCount: faqFromBody(text).length,
      photoCount: page.photoCount,
      factsAgeDays: fresh.age,
      inbound: page.inbound,
      outbound: page.contentOutbound,
      orphan: page.orphan,
      httpStatus: indexing.status,
      inSitemap: indexing.sitemap,
      jsonLdTypes: indexing.types,
      titleLength: indexing.title.length,
      descriptionLength: indexing.description.length,
      yandexIndexed: indexing.hooks.yandex,
      googleIndexed: indexing.hooks.google,
      organic7d: page.results.organic7d,
      organic30d: page.results.organic30d,
      organic90d: page.results.organic90d,
      goal30d: page.passport?.goal30d ?? null,
      goal90d: page.passport?.goal90d ?? null,
      queries: page.results.queries,
      searchImported: page.results.searchImported,
      scrollMax: page.results.scrollMax,
      avgEngagedSec: page.results.avgEngagedSec,
      nextClicks: page.results.nextClicks,
      pageviews30d: page.results.pageviews30d,
    },
    organic30d: page.results.organic30d,
    organic90d: page.results.organic90d,
    goal30d: page.passport?.goal30d ?? null,
    goal90d: page.passport?.goal90d ?? null,
  }
}

export function topIssue(checks: ScoreChecks, blocks: Pick<PageScore, 'quality' | 'linking' | 'indexing' | 'results'>) {
  const names = ['quality', 'linking', 'indexing', 'results'] as const
  const ordered = [...names].sort((a, b) => blocks[a] - blocks[b] || names.indexOf(a) - names.indexOf(b))
  for (const name of ordered) {
    const check = checks[name][0]
    if (check) {
      return check
    }
  }
  return null
}

export function issueLabel(check: string) {
  const rules: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^no FAQ$/, () => 'Нет частых вопросов'],
    [/^FAQ (\d+), need 6$/, (match) => `Частых вопросов: ${match[1]}, нужно 6`],
    [/^no prices$/, () => 'Нет цен или режима'],
    [/^no Как добраться$/, () => 'Нет блока «Как добраться»'],
    [/^0 photos$/, () => 'Нет фотографий'],
    [/^(\d+) photos?, need (\d+)$/, (match) => `Фотографий: ${match[1]}, нужно ${match[2]}`],
    [/^facts not checked$/, () => 'Факты не проверены'],
    [/^facts checked (\d+) days ago$/, (match) => `Факты проверены ${match[1]} дн. назад`],
    [/^passport empty$/, () => 'Паспорт пустой'],
    [/^no target queries$/, () => 'Нет целевых запросов'],
    [/^no audience$/, () => 'Нет аудитории'],
    [/^no action$/, () => 'Нет действия'],
    [/^no 30-day goal$/, () => 'Нет цели на 30 дней'],
    [/^no 90-day goal$/, () => 'Нет цели на 90 дней'],
    [/^orphan$/, () => 'Нет входящих ссылок'],
    [/^no inbound$/, () => 'Нет входящих ссылок'],
    [/^inbound (\d+)$/, (match) => `Входящих ссылок: ${match[1]}`],
    [/^no outbound$/, () => 'Нет исходящих ссылок'],
    [/^outbound (\d+)$/, (match) => `Исходящих ссылок: ${match[1]}`],
    [/^not in a route or collection$/, () => 'Нет в маршруте или подборке'],
    [/^no stops$/, () => 'Нет точек маршрута'],
    [/^few stops$/, () => 'Мало точек маршрута'],
    [/^no items$/, () => 'Нет мест в подборке'],
    [/^few items$/, () => 'Мало мест в подборке'],
    [/^description missing$/, () => 'Нет описания'],
    [/^description (\d+) chars, need 300-600$/, (match) => `Описание ${match[1]} знаков, нужно 300-600`],
    [/^no hours$/, () => 'Нет часов работы'],
    [/^no coordinates$/, () => 'Нет координат'],
    [/^no steps$/, () => 'Нет шагов квеста'],
    [/^few steps$/, () => 'Мало шагов квеста'],
    [/^empty hub$/, () => 'В разделе нет мест'],
    [/^not in sitemap$/, () => 'Нет в карте сайта'],
    [/^not 200$/, () => 'Страница не открывается'],
    [/^noindex$/, () => 'Закрыта от индекса'],
    [/^no [A-Za-z]+$/, (match) => `Нет JSON-LD: ${match[0].slice(3)}`],
    [/^title (\d+) chars$/, (match) => `Заголовок ${match[1]} знаков`],
    [/^description (\d+) chars$/, (match) => `Описание ${match[1]} знаков`],
    [/^no canonical$/, () => 'Нет канонического адреса'],
    [/^canonical (.+)$/, () => 'Канонический адрес не совпадает'],
    [/^not in Yandex$/, () => 'Нет в индексе Яндекса'],
    [/^not in Google$/, () => 'Нет в индексе Google'],
    [/^organic 30d: (\d+), goal (\d+)$/, (match) => `Поиск за 30 дней: ${match[1]}, цель ${match[2]}`],
    [/^organic 90d: (\d+), goal (\d+)$/, (match) => `Поиск за 90 дней: ${match[1]}, цель ${match[2]}`],
    [/^no search queries$/, () => 'Нет поисковых запросов'],
    [/^scroll not tracked$/, () => 'Прокрутка не измеряется'],
    [/^scroll (\d+)$/, (match) => `Прокрутка ${match[1]}%`],
    [/^engaged time not tracked$/, () => 'Время на странице не измеряется'],
    [/^engaged (\d+)s$/, (match) => `Вовлечение ${match[1]} с`],
    [/^no clicks to the next page$/, () => 'Нет переходов дальше'],
    [/^body (\d+) chars, need (.+)$/, (match) => `Текст ${match[1]} знаков, нужно ${match[2]}`],
    [/^body (\d+) chars, above (\d+)$/, (match) => `Текст ${match[1]} знаков, больше ${match[2]}`],
  ]
  for (const [pattern, label] of rules) {
    const match = check.match(pattern)
    if (match) {
      return label(match)
    }
  }
  return check
}

export interface WeeklyScore {
  path: string
  title: string
  pageType: PageKind
  total: number
  quality: number
  linking: number
  indexing: number
  results: number
  organic30d: number
  organic90d: number
  goal30d: number | null
  goal90d: number | null
}

function average(rows: WeeklyScore[]) {
  if (!rows.length) {
    return { total: 0, quality: 0, linking: 0, indexing: 0, results: 0 }
  }
  const sum = rows.reduce((acc, row) => ({
    total: acc.total + row.total,
    quality: acc.quality + row.quality,
    linking: acc.linking + row.linking,
    indexing: acc.indexing + row.indexing,
    results: acc.results + row.results,
  }), { total: 0, quality: 0, linking: 0, indexing: 0, results: 0 })
  const count = rows.length
  return {
    total: Math.round(sum.total / count),
    quality: Math.round(sum.quality / count),
    linking: Math.round(sum.linking / count),
    indexing: Math.round(sum.indexing / count),
    results: Math.round(sum.results / count),
  }
}

export function buildWeeklyReport(current: WeeklyScore[], previous: WeeklyScore[] | null, days: { current: string, previous: string | null }) {
  const currentAverage = average(current)
  const previousAverage = previous ? average(previous) : null
  const delta = previousAverage
    ? {
        total: currentAverage.total - previousAverage.total,
        quality: currentAverage.quality - previousAverage.quality,
        linking: currentAverage.linking - previousAverage.linking,
        indexing: currentAverage.indexing - previousAverage.indexing,
        results: currentAverage.results - previousAverage.results,
      }
    : null
  const top = [...current].sort((a, b) => b.total - a.total || a.path.localeCompare(b.path)).slice(0, 5)
  const bottom = [...current].sort((a, b) => a.total - b.total || a.path.localeCompare(b.path)).slice(0, 5)
  const missingGoals = current.filter((row) => (
    (row.goal30d != null && row.organic30d < row.goal30d)
    || (row.goal90d != null && row.organic90d < row.goal90d)
  )).map((row) => ({
    path: row.path,
    title: row.title,
    pageType: row.pageType,
    organic30d: row.organic30d,
    goal30d: row.goal30d,
    organic90d: row.organic90d,
    goal90d: row.goal90d,
  }))
  const previousByPath = new Map((previous ?? []).map((row) => [row.path, row]))
  const drops = current.flatMap((row) => {
    const before = previousByPath.get(row.path)
    if (!before) {
      return []
    }
    const change = row.total - before.total
    if (change >= 0) {
      return []
    }
    return [{ path: row.path, title: row.title, total: row.total, previous: before.total, delta: change }]
  }).sort((a, b) => a.delta - b.delta || a.path.localeCompare(b.path)).slice(0, 5)
  return {
    currentDay: days.current,
    previousDay: days.previous,
    pages: current.length,
    average: currentAverage,
    previousAverage,
    delta,
    top,
    bottom,
    missingGoals,
    drops,
  }
}

export interface ScoreFilter {
  pageType?: PageKind
  block?: ScoreBlock
  below?: number
  sort?: 'total' | ScoreBlock | 'title' | 'path'
  order?: 'asc' | 'desc'
}

export function filterScores<T extends WeeklyScore & { title: string }>(rows: T[], query: ScoreFilter) {
  const filtered = rows.filter((row) => {
    if (query.pageType && row.pageType !== query.pageType) {
      return false
    }
    if (query.below == null) {
      return true
    }
    const value = query.block ? row[query.block] : row.total
    return value < query.below
  })
  const sort = query.sort || (query.block ?? 'total')
  const direction = query.order === 'desc' ? -1 : 1
  return filtered.sort((a, b) => {
    if (sort === 'title' || sort === 'path') {
      return a[sort].localeCompare(b[sort], 'ru') * direction
    }
    return ((a[sort] - b[sort]) || a.path.localeCompare(b.path)) * direction
  })
}

export function queriesForPath(path: string, rows: Array<{ page: string, query: string }>, targets: string[]) {
  const wanted = new Set(targets.map((query) => query.trim().toLowerCase()).filter(Boolean))
  const found = new Set<string>()
  for (const row of rows) {
    const page = row.page.trim()
    let pathname = page
    if (page.startsWith('http://') || page.startsWith('https://')) {
      try {
        pathname = new URL(page).pathname
      } catch {
        pathname = page
      }
    }
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }
    const named = page === path || pathname === path
    const sitewide = page === '' && wanted.has(row.query.trim().toLowerCase())
    if (named || sitewide) {
      found.add(row.query)
    }
  }
  return [...found]
}

const PAGE_TITLE: Record<PageKind, string> = {
  place: 'место',
  route: 'маршрут',
  collection: 'подборка',
  hub: 'раздел',
  quest: 'квест',
  venue: 'заведение',
}

export function pageKindLabel(kind: PageKind) {
  return PAGE_TITLE[kind]
}

export function passportFilled(passport: PassportFields | null) {
  return passportPoints(passport).checks.length === 0
}
