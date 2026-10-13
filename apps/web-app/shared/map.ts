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
}

export interface RouteOverlay {
  stops: Array<MapRouteStop & { id: string }>
  line: [number, number][] | null
  dashed: boolean
}

export interface MapQueryState {
  sights: SightId[] | null
  food: string[] | null
  route: string | null
  q: string
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
  return {
    sights: sightRaw as SightId[] | null,
    food: foodRaw,
    route: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route) ? route : null,
    q,
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
