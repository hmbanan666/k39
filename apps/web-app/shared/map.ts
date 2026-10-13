import type { MapCard, MapLayer, MapPointInput, MapStopInput } from '@k39/map'
import { lineLayer, pointsLayer, stopsLayer } from '@k39/map'
import { illustrationFor } from './illustrations'

export const SIGHT_FACETS = [
  { id: 'forty', label: 'Форты' },
  { id: 'zamki', label: 'Замки' },
  { id: 'plyazhi', label: 'Пляжи' },
  { id: 'muzei', label: 'Музеи' },
  { id: 'tserkvi', label: 'Церкви' },
  { id: 'kurorty', label: 'Курорты' },
] as const

export type SightId = (typeof SIGHT_FACETS)[number]['id']

const SIGHT_IDS = new Set<string>(SIGHT_FACETS.map((item) => item.id))

// Path segments match the venue catalog (kofe, kafe, ...). Kept here so the
// client map does not import the database package.
export const FOOD_FILTERS = [
  { id: 'coffee', path: 'kofe', label: 'Кофейни' },
  { id: 'restaurant', path: 'restoran', label: 'Рестораны' },
  { id: 'cafe', path: 'kafe', label: 'Кафе' },
  { id: 'bakery', path: 'pekarnya', label: 'Пекарни' },
  { id: 'bar', path: 'bar', label: 'Бары' },
  { id: 'market', path: 'rynok', label: 'Рынки' },
  { id: 'fastfood', path: 'fastfud', label: 'Фастфуд' },
  { id: 'other', path: 'drugoe', label: 'Другое' },
] as const

export type FoodId = (typeof FOOD_FILTERS)[number]['id'] | 'eda'

const FOOD_BY_PATH = new Map<string, string>(FOOD_FILTERS.map((item) => [item.path, item.id]))
const FOOD_BY_ID = new Map<string, string>(FOOD_FILTERS.map((item) => [item.id, item.path]))

const CHURCH = /sobor|kirha|kirkha|tserkov|kostyol|kostel|собор|кирх|церков|костёл|костел/i

export interface MapPoint {
  id: string
  group: 'sight' | 'food'
  slug: string
  title: string
  href: string
  latitude: number
  longitude: number
  category: string
  marker: string
  church: boolean
  kindLabel: string
  summary: string
  photo: string | null
  partner: boolean
  stale: boolean
  address?: string | null
  hours?: string | null
}

export interface MapRouteStop {
  position: number
  title: string
  href: string
  latitude: number
  longitude: number
  summary: string
  photo: string | null
}

export interface MapRoute {
  slug: string
  title: string
  href: string
  stops: MapRouteStop[]
  path: [number, number][] | null
  summary?: string
}

export interface RouteOverlay {
  stops: Array<MapRouteStop & { id: string }>
  line: [number, number][] | null
  dashed: boolean
}

export const BROWSE_CATEGORIES = [
  { id: 'sights', label: 'Достопримечательности' },
  { id: 'food', label: 'Где поесть' },
  { id: 'beaches', label: 'Пляжи' },
  { id: 'routes', label: 'Маршруты' },
] as const

export type BrowseCategory = (typeof BROWSE_CATEGORIES)[number]['id']

export const SIGHT_BROWSE = SIGHT_FACETS.filter((item) => item.id !== 'plyazhi')

export interface MapQueryState {
  sights: SightId[] | null
  food: string[] | null
  route: string | null
  q: string
  category: BrowseCategory | null
}

export interface MapBounds {
  west: number
  south: number
  east: number
  north: number
}

export interface MapOrigin {
  latitude: number
  longitude: number
}

export function isChurchPlace(slug: string, title: string) {
  return CHURCH.test(`${slug} ${title}`)
}

export function markerArt(marker: string, slug?: string | null) {
  if (marker === 'tserkvi') {
    return illustrationFor('cathedral', slug)
  }
  if (marker === 'eda' || FOOD_BY_ID.has(marker)) {
    return illustrationFor('eda', slug)
  }
  return illustrationFor(marker, slug)
}

export function blurb(value: string | null | undefined, max = 120) {
  const text = (value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) {
    return text
  }
  const cut = text.slice(0, max - 3).replace(/\s+\S*$/, '')
  return `${cut || text.slice(0, max - 3)}...`
}

export function partnerVisible(flag: boolean, sponsored: boolean) {
  return flag === true && sponsored === true
}

export function normalizeRoutePath(value: unknown): [number, number][] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 5000) {
    return null
  }
  const coords: [number, number][] = []
  for (const pair of value) {
    if (!Array.isArray(pair) || pair.length < 2) {
      return null
    }
    const lng = Number(pair[0])
    const lat = Number(pair[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return null
    }
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return null
    }
    coords.push([lng, lat])
  }
  return coords
}

export function routeOverlay(route: MapRoute | null): RouteOverlay | null {
  if (!route) {
    return null
  }
  const stops = route.stops
    .filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude))
    .sort((a, b) => a.position - b.position)
    .map((stop, index) => ({ ...stop, position: index + 1, id: `stop:${stop.href}` }))
  const path = normalizeRoutePath(route.path)
  if (path) {
    return { stops, line: path, dashed: false }
  }
  if (stops.length >= 2) {
    return {
      stops,
      line: stops.map((stop) => [stop.longitude, stop.latitude]),
      dashed: true,
    }
  }
  return { stops, line: null, dashed: false }
}

function queryValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(',')
  }
  if (value == null) {
    return ''
  }
  return String(value)
}

function parseIdList(raw: string, allowed: Set<string>) {
  if (!raw) {
    return null
  }
  if (raw === 'none' || raw === '0') {
    return []
  }
  const ids = raw.split(',').map((item) => item.trim()).filter((item) => allowed.has(item))
  return [...new Set(ids)]
}

export function foodIdsIn(points: MapPoint[]) {
  const ids: string[] = FOOD_FILTERS.map((item) => item.id)
  if (points.some((point) => point.group === 'food' && point.category === 'eda')) {
    ids.push('eda')
  }
  return ids
}

export function parseMapQuery(query: Record<string, unknown>): MapQueryState {
  const sightRaw = parseIdList(queryValue(query.s), SIGHT_IDS)
  const foodAllowed = new Set<string>([...FOOD_FILTERS.map((item) => item.id), 'eda'])
  const foodTokens = queryValue(query.f)
  const foodRaw = foodTokens
    ? parseIdList(
        foodTokens.split(',').map((token) => FOOD_BY_PATH.get(token.trim()) || token.trim()).join(','),
        foodAllowed,
      )
    : null
  const route = queryValue(query.r).trim()
  const q = queryValue(query.q).replace(/\s+/g, ' ').trim().slice(0, 80)
  const categoryRaw = queryValue(query.c).trim()
  const category = BROWSE_CATEGORIES.some((item) => item.id === categoryRaw)
    ? categoryRaw as BrowseCategory
    : null
  return {
    sights: sightRaw as SightId[] | null,
    food: foodRaw,
    route: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route) ? route : null,
    q,
    category,
  }
}

function sameSet(list: string[] | null, all: readonly string[]) {
  if (list == null) {
    return true
  }
  if (list.length !== all.length) {
    return false
  }
  const have = new Set(list)
  return all.every((id) => have.has(id))
}

export function canonicalSights(sights: SightId[] | null): SightId[] | null {
  return sameSet(sights, SIGHT_FACETS.map((item) => item.id)) ? null : sights
}

export function canonicalFood(food: string[] | null, all: readonly string[]): string[] | null {
  return sameSet(food, all) ? null : food
}

export function mapQueryRecord(state: MapQueryState, foodAll: readonly string[] = FOOD_FILTERS.map((item) => item.id)) {
  const query: Record<string, string> = {}
  const sights = canonicalSights(state.sights)
  const food = canonicalFood(state.food, foodAll)
  if (sights) {
    query.s = sights.length ? sights.join(',') : 'none'
  }
  if (food) {
    const tokens = food.map((id) => FOOD_BY_ID.get(id) || id)
    query.f = tokens.length ? tokens.join(',') : 'none'
  }
  if (state.route) {
    query.r = state.route
  }
  if (state.q) {
    query.q = state.q
  }
  if (state.category) {
    query.c = state.category
  }
  return query
}

export function toggleId(current: string[] | null, id: string, all: readonly string[]) {
  const base = current == null ? [...all] : [...current]
  const next = base.includes(id) ? base.filter((item) => item !== id) : [...base, id]
  return sameSet(next, all) ? null : next
}

export function pointVisible(point: MapPoint, state: MapQueryState) {
  const q = state.q.trim().toLocaleLowerCase('ru')
  if (q && !`${point.title} ${point.kindLabel}`.toLocaleLowerCase('ru').includes(q)) {
    return false
  }
  if (point.group === 'sight') {
    if (state.sights == null) {
      return true
    }
    if (!state.sights.length) {
      return false
    }
    if (state.sights.includes(point.category as SightId)) {
      return true
    }
    return point.church && state.sights.includes('tserkvi')
  }
  if (state.food == null) {
    return true
  }
  if (!state.food.length) {
    return false
  }
  return state.food.includes(point.category)
}

export function facetCounts(points: MapPoint[]) {
  const sights = Object.fromEntries(SIGHT_FACETS.map((item) => [item.id, 0])) as Record<SightId, number>
  const food: Record<string, number> = Object.fromEntries(FOOD_FILTERS.map((item) => [item.id, 0]))
  for (const point of points) {
    if (point.group === 'sight') {
      const key = point.category as SightId
      if (sights[key] != null) {
        sights[key] += 1
      }
      if (point.church) {
        sights.tserkvi += 1
      }
      continue
    }
    food[point.category] = (food[point.category] || 0) + 1
  }
  return { sights, food }
}

export function sortMapPoints(points: MapPoint[]) {
  return [...points].sort((a, b) => {
    if (a.partner !== b.partner) {
      return a.partner ? -1 : 1
    }
    return a.title.localeCompare(b.title, 'ru')
  })
}

function placeCard(point: MapPoint): MapCard {
  return {
    id: point.id,
    title: point.title,
    href: point.href,
    kindLabel: point.kindLabel,
    summary: point.summary,
    photo: point.photo,
    partner: point.partner,
    stale: point.stale,
    marker: point.marker,
  }
}

function placeInput(point: MapPoint): MapPointInput {
  return {
    id: point.id,
    coordinates: [point.longitude, point.latitude],
    marker: point.marker,
    title: point.title,
    sponsored: point.partner,
    card: placeCard(point),
  }
}

function stopInput(stop: RouteOverlay['stops'][number]): MapStopInput {
  return {
    id: stop.id,
    n: stop.position,
    coordinates: [stop.longitude, stop.latitude],
    title: stop.title,
    card: {
      id: stop.id,
      title: stop.title,
      href: stop.href,
      kindLabel: `Остановка ${stop.position}`,
      summary: stop.summary,
      photo: stop.photo,
      partner: false,
      stale: false,
      marker: 'forty',
    },
  }
}

/** Visitor scene: one clustered point layer, then an optional route line under it and numbered stops on top. */
export function visitorLayers(points: MapPoint[], overlay: RouteOverlay | null): MapLayer[] {
  const hrefs = new Set((overlay?.stops ?? []).map((stop) => stop.href))
  const visible = hrefs.size ? points.filter((point) => !hrefs.has(point.href)) : points
  const layers: MapLayer[] = []
  if (overlay?.line && overlay.line.length >= 2) {
    layers.push(lineLayer('route', overlay.line, { dashed: overlay.dashed }))
  }
  layers.push(pointsLayer('places', visible.map(placeInput), { cluster: true }))
  if (overlay?.stops.length) {
    layers.push(stopsLayer('route-stops', overlay.stops.map(stopInput)))
  }
  return layers
}

export function queriesEqual(a: Record<string, string>, b: Record<string, unknown>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if ((a[key] || '') !== queryValue(b[key])) {
      return false
    }
  }
  return true
}

const EMPTY_QUERY: MapQueryState = { sights: null, food: null, route: null, q: '', category: null }

export function distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const toRad = (value: number) => value * Math.PI / 180
  const dLat = toRad(toLat - fromLat)
  const dLng = toRad(toLng - fromLng)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistance(km: number) {
  if (!Number.isFinite(km) || km < 0) {
    return ''
  }
  if (km < 0.95) {
    const meters = Math.max(50, Math.round((km * 1000) / 10) * 10)
    return `${meters} м`
  }
  const digits = km < 10 ? 1 : 0
  return `${km.toFixed(digits).replace('.', ',')} км`
}

export function stopsLabel(count: number) {
  const n = Math.abs(count) % 100
  const n1 = n % 10
  if (n > 10 && n < 20) {
    return `${count} остановок`
  }
  if (n1 === 1) {
    return `${count} остановка`
  }
  if (n1 >= 2 && n1 <= 4) {
    return `${count} остановки`
  }
  return `${count} остановок`
}

export function routeLengthKm(route: MapRoute) {
  const line = route.path && route.path.length >= 2
    ? route.path
    : [...route.stops]
        .filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude))
        .sort((a, b) => a.position - b.position)
        .map((stop) => [stop.longitude, stop.latitude] as [number, number])
  let km = 0
  for (let index = 1; index < line.length; index += 1) {
    const prev = line[index - 1]
    const next = line[index]
    if (!prev || !next) {
      continue
    }
    km += distanceKm(prev[1], prev[0], next[1], next[0])
  }
  return km
}

export function routeDurationLabel(route: MapRoute) {
  const km = routeLengthKm(route)
  if (km <= 0.05) {
    return ''
  }
  const minutes = Math.max(10, Math.round(km < 8 ? (km / 4.5) * 60 : (km / 45) * 60))
  if (minutes < 60) {
    return `около ${minutes} мин`
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest < 10) {
    return `около ${hours} ч`
  }
  return `около ${hours} ч ${rest} мин`
}

export function routeThumb(route: MapRoute) {
  return route.stops.find((stop) => stop.photo)?.photo ?? null
}

export function inBounds(point: { latitude: number, longitude: number }, bounds: MapBounds) {
  return point.longitude >= bounds.west
    && point.longitude <= bounds.east
    && point.latitude >= bounds.south
    && point.latitude <= bounds.north
}

export function boundsCenter(bounds: MapBounds): MapOrigin {
  return {
    latitude: (bounds.south + bounds.north) / 2,
    longitude: (bounds.west + bounds.east) / 2,
  }
}

function sightChosen(point: MapPoint, sights: SightId[] | null) {
  if (sights == null) {
    return true
  }
  if (!sights.length) {
    return false
  }
  if (sights.includes(point.category as SightId)) {
    return true
  }
  return point.church && sights.includes('tserkvi')
}

export function pointInCategory(point: MapPoint, category: BrowseCategory, state: MapQueryState = EMPTY_QUERY) {
  if (category === 'beaches') {
    return point.group === 'sight' && point.category === 'plyazhi'
  }
  if (category === 'food') {
    if (point.group !== 'food') {
      return false
    }
    if (state.food == null) {
      return true
    }
    if (!state.food.length) {
      return false
    }
    return state.food.includes(point.category)
  }
  if (category === 'sights') {
    if (point.group !== 'sight' || point.category === 'plyazhi') {
      return false
    }
    return sightChosen(point, state.sights)
  }
  return false
}

export function activeCategory(state: MapQueryState): BrowseCategory | null {
  if (state.category) {
    return state.category
  }
  if (state.route) {
    return 'routes'
  }
  const foodOn = state.food != null && state.food.length > 0
  const sightsOn = state.sights != null && state.sights.length > 0
  if (foodOn && !sightsOn) {
    return 'food'
  }
  if (state.sights?.length === 1 && state.sights[0] === 'plyazhi' && !foodOn) {
    return 'beaches'
  }
  if (sightsOn && !foodOn) {
    return 'sights'
  }
  return null
}

export function browseCounts(points: MapPoint[], routeCount: number) {
  return {
    sights: points.filter((point) => pointInCategory(point, 'sights')).length,
    food: points.filter((point) => pointInCategory(point, 'food')).length,
    beaches: points.filter((point) => pointInCategory(point, 'beaches')).length,
    routes: routeCount,
  }
}

function textHit(point: MapPoint, query: string) {
  const q = query.trim().toLocaleLowerCase('ru')
  if (!q) {
    return true
  }
  return `${point.title} ${point.kindLabel} ${point.address || ''}`.toLocaleLowerCase('ru').includes(q)
}

function relevance(point: MapPoint, query: string) {
  const q = query.trim().toLocaleLowerCase('ru')
  if (!q) {
    return point.partner ? 1 : 0
  }
  const title = point.title.toLocaleLowerCase('ru')
  if (title.startsWith(q)) {
    return 3
  }
  if (title.includes(q)) {
    return 2
  }
  return 1
}

export function sortForBrowse(points: MapPoint[], origin: MapOrigin | null, query = '') {
  return [...points].sort((a, b) => {
    const rank = relevance(b, query) - relevance(a, query)
    if (rank) {
      return rank
    }
    if (origin) {
      const left = distanceKm(origin.latitude, origin.longitude, a.latitude, a.longitude)
      const right = distanceKm(origin.latitude, origin.longitude, b.latitude, b.longitude)
      if (Math.abs(left - right) > 0.04) {
        return left - right
      }
    }
    if (a.partner !== b.partner) {
      return a.partner ? -1 : 1
    }
    return a.title.localeCompare(b.title, 'ru')
  })
}

const CURATED_ORDER = ['forty', 'zamki', 'plyazhi', 'muzei', 'tserkvi', 'kurorty'] as const

function byPhoto(pool: MapPoint[]) {
  return [...pool].sort((a, b) => {
    const photo = Number(Boolean(b.photo)) - Number(Boolean(a.photo))
    if (photo) {
      return photo
    }
    return a.title.localeCompare(b.title, 'ru')
  })
}

export function curatedSights(points: MapPoint[], limit = 6) {
  const sights = points.filter((point) => point.group === 'sight')
  const picked: MapPoint[] = []
  const used = new Set<string>()
  for (const category of CURATED_ORDER) {
    const pool = sights.filter((point) => !used.has(point.id) && (category === 'tserkvi'
      ? point.church || point.category === 'tserkvi'
      : point.category === category))
    const best = byPhoto(pool)[0]
    if (best) {
      picked.push(best)
      used.add(best.id)
    }
  }
  const perCategory = new Map<string, number>()
  for (const item of picked) {
    const key = item.church ? 'tserkvi' : item.category
    perCategory.set(key, (perCategory.get(key) || 0) + 1)
  }
  for (const item of byPhoto(sights.filter((point) => !used.has(point.id)))) {
    if (picked.length >= limit) {
      break
    }
    const key = item.church ? 'tserkvi' : item.category
    if ((perCategory.get(key) || 0) >= 2) {
      continue
    }
    picked.push(item)
    perCategory.set(key, (perCategory.get(key) || 0) + 1)
  }
  return picked.slice(0, limit)
}

export function popularRoutes(routes: MapRoute[], limit = 3) {
  return [...routes]
    .sort((a, b) => b.stops.length - a.stops.length || a.title.localeCompare(b.title, 'ru'))
    .slice(0, limit)
}

export function shownPoints(points: MapPoint[], state: MapQueryState) {
  const category = activeCategory(state)
  const matched = state.q.trim()
    ? points.filter((point) => textHit(point, state.q))
    : points
  if (state.q.trim()) {
    if (!category || category === 'routes') {
      return matched
    }
    return matched.filter((point) => pointInCategory(point, category, state))
  }
  if (category === 'routes') {
    return []
  }
  if (category) {
    return matched.filter((point) => pointInCategory(point, category, state))
  }
  if (state.sights != null || state.food != null) {
    return points.filter((point) => pointVisible(point, state))
  }
  return curatedSights(points)
}

export function browseList(points: MapPoint[], bounds: MapBounds | null, origin: MapOrigin | null, query = '') {
  const inside = bounds ? points.filter((point) => inBounds(point, bounds)) : points
  if (inside.length || !query.trim()) {
    return { items: sortForBrowse(inside, origin, query), nearby: false }
  }
  return { items: sortForBrowse(points, origin, query).slice(0, 8), nearby: true }
}
