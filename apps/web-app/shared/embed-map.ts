import { formatDistance } from './links'

// Straight line, about a fifteen-minute walk. The same approximation as the «около» legs.
export const WALKING_RADIUS_KM = 1.2

export const MAP_FRAME_MIN_PX = 160

// OpenFreeMap Positron: OSM data (ODbL), no API key. The style credits OpenStreetMap.
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

export const MAP_MAX_ZOOM = 18

const GLYPHS: Record<string, string> = {
  place: '<path d="M8 1.2 13.2 6v8.2H2.8V6z"/>',
  cafe: '<path d="M3 6h6.2v3.2a3.1 3.1 0 0 1-6.2 0zM9.2 6.4h2.4a2 2 0 0 1 0 4H9.2"/>',
  restaurant: '<path d="M5 2v5M8 2v5M11 2v5M5 4.5h6M8 7v7"/>',
  coffee: '<path d="M3.2 7h5.6v2.6a2.8 2.8 0 0 1-5.6 0zM8.8 7.3h2.2a1.7 1.7 0 0 1 0 3.4H8.8M6 2.2c.4.8-.4 1.2 0 2"/>',
  bar: '<path d="M4 2h8L10.2 8.2A2.4 2.4 0 0 1 5.8 8.2zM8 10.4V14M5.5 14h5"/>',
  bakery: '<path d="M2.5 10.5C3.5 5 12.5 5 13.5 10.5V14h-11z"/>',
  market: '<path d="M2 8.5 8 2.2 14 8.5V14H2z"/>',
  fastfood: '<path d="M4.2 4.5h7.6L10.6 14H5.4z"/>',
  other: '<circle cx="8" cy="8" r="3"/>',
}

export interface MapPhoto {
  src: string
  alt: string
}

export interface MapPoint {
  id: string
  layer: 'place' | 'venue' | 'route'
  kind: string
  title: string
  typeLabel: string
  href: string
  latitude: number
  longitude: number
  summary: string
  distanceKm: number | null
  distance: string
  photo: MapPhoto | null
  partner: boolean
  offer: string | null
  label: string
}

export interface MapRouteLine {
  slug: string
  title: string
  href: string
  stops: Array<{
    latitude: number
    longitude: number
    label: string
    href: string
    title: string
  }>
}

export interface MapPayload {
  sponsored: boolean
  walkingKm: number
  points: MapPoint[]
  routes: MapRouteLine[]
}

export interface MapQuery {
  scope: 'nearby' | 'catalog'
  latitude: number | null
  longitude: number | null
  route: string
  radiusKm: number
}

export function yandexDestinationUrl(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return ''
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return ''
  }
  return `https://yandex.ru/maps/?rtext=~${latitude.toFixed(5)},${longitude.toFixed(5)}&rtt=auto`
}

export function resolvedFrameHeight(measured: number, fallback: number) {
  if (Number.isFinite(measured) && measured >= MAP_FRAME_MIN_PX) {
    return Math.round(measured)
  }
  return fallback
}

export function mapDistanceLabel(km: number | null) {
  if (km == null || !Number.isFinite(km) || km < 0.05) {
    return ''
  }
  return formatDistance(km)
}

export function shortMapText(value: string, max = 140) {
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length <= max) {
    return text
  }
  const cut = text.slice(0, max - 1).replace(/\s+\S*$/, '').trim()
  return `${cut || text.slice(0, max - 1)}…`
}

export function pinOffer(input: { partner: boolean, offer: string | null }, enabled: boolean) {
  if (!enabled || !input.partner || !input.offer?.trim()) {
    return { partner: false, offer: null as string | null }
  }
  return { partner: true, offer: input.offer.trim() }
}

function finiteIn(value: string | undefined, min: number, max: number) {
  if (!value?.trim()) {
    return null
  }
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) {
    return null
  }
  return number
}

export function parseMapQuery(input: { scope?: string, lat?: string, lng?: string, route?: string, radius?: string }): MapQuery {
  const latitude = finiteIn(input.lat, -90, 90)
  const longitude = finiteIn(input.lng, -180, 180)
  const routeRaw = (input.route || '').trim().toLowerCase()
  const route = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(routeRaw) ? routeRaw.slice(0, 80) : ''
  const hasPoint = latitude != null && longitude != null
  const scope: MapQuery['scope'] = input.scope === 'catalog' || (!hasPoint && !route) ? 'catalog' : 'nearby'
  let radiusKm = WALKING_RADIUS_KM
  const asked = input.radius?.trim() ? Number(input.radius) : Number.NaN
  if (Number.isFinite(asked)) {
    radiusKm = Math.min(8, Math.max(0.2, asked))
  }
  return { scope, latitude, longitude, route, radiusKm }
}

export interface ClusterInput {
  id: string
  latitude: number
  longitude: number
}

export interface PointCluster<T> {
  latitude: number
  longitude: number
  points: T[]
}

function project(latitude: number, longitude: number, zoom: number) {
  const scale = 256 * 2 ** zoom
  const x = ((longitude + 180) / 360) * scale
  const sine = Math.sin((latitude * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale
  return { x, y }
}

export function clusterPoints<T extends ClusterInput>(points: T[], zoom: number, radiusPx = 46): Array<PointCluster<T>> {
  const pending = points.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
  const clusters: Array<PointCluster<T>> = []
  const radiusSq = radiusPx * radiusPx
  while (pending.length) {
    const seed = pending.shift()
    if (!seed) {
      break
    }
    const group = [seed]
    const origin = project(seed.latitude, seed.longitude, zoom)
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const other = pending[index]
      if (!other) {
        continue
      }
      const pos = project(other.latitude, other.longitude, zoom)
      const dx = pos.x - origin.x
      const dy = pos.y - origin.y
      if (dx * dx + dy * dy <= radiusSq) {
        group.push(other)
        pending.splice(index, 1)
      }
    }
    const latitude = group.reduce((sum, point) => sum + point.latitude, 0) / group.length
    const longitude = group.reduce((sum, point) => sum + point.longitude, 0) / group.length
    clusters.push({ latitude, longitude, points: group })
  }
  return clusters
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const named: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }
    return named[char] ?? char
  })
}

export function pinClassName(point: { layer: string, kind: string, partner: boolean, focus: boolean }) {
  const names = ['k39-pin', `k39-pin-${point.layer}`]
  if (point.layer === 'venue' && point.kind) {
    names.push(`k39-kind-${point.kind}`)
  }
  if (point.partner) {
    names.push('k39-pin-partner')
  }
  if (point.focus) {
    names.push('k39-pin-focus')
  }
  return names.join(' ')
}

function glyphFor(point: { layer: string, kind: string }) {
  if (point.layer === 'route') {
    return ''
  }
  const key = point.layer === 'place' ? 'place' : (GLYPHS[point.kind] ? point.kind : 'other')
  const path = GLYPHS[key] || GLYPHS.other
  return `<svg viewBox="0 0 16 16" aria-hidden="true">${path}</svg>`
}

export function pinButtonHtml(point: { title: string, label: string, layer: string, kind: string, partner: boolean, focus: boolean }) {
  const inner = point.layer === 'route'
    ? `<span>${escapeHtml(point.label)}</span>`
    : glyphFor(point)
  return `<button type="button" class="${pinClassName(point)}" aria-label="${escapeHtml(point.title)}">${inner}</button>`
}
