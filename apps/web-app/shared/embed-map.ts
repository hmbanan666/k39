import { formatDistance } from './links'

// Straight line, about a fifteen-minute walk. The same approximation as the «около» legs.
export const WALKING_RADIUS_KM = 1.2

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
