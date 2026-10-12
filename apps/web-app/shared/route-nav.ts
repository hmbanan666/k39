import { formatDistance, haversineKm } from './links'

export type RouteTravelMode = 'auto' | 'pd' | 'mt'

export const ROUTE_TRAVEL_MODES: Array<{ value: RouteTravelMode, label: string }> = [
  { value: 'auto', label: 'На машине' },
  { value: 'pd', label: 'Пешком' },
  { value: 'mt', label: 'Транспорт' },
]

export interface RoutePoint {
  latitude: number
  longitude: number
}

export interface RouteMapPoint extends RoutePoint {
  label: string
  title: string
}

export interface RouteStopInput {
  href: string
  text: string
  note?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface RouteStopView {
  href: string
  text: string
  note: string | null
  latitude: number | null
  longitude: number | null
  distanceLabel: string | null
}

const GOOGLE_TRAVEL: Record<RouteTravelMode, string> = {
  auto: 'driving',
  pd: 'walking',
  mt: 'transit',
}

function finiteCoord(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

// Five decimals is about one metre and keeps the deep link stable.
function pair(point: RoutePoint) {
  return `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`
}

// Straight line, not the road. «около» marks that approximation for every leg.
export function formatStraightLine(km: number) {
  const text = formatDistance(km)
  if (!text) {
    return ''
  }
  return text.startsWith('около ') ? text : `около ${text}`
}

export function straightLineLabel(km: number | null) {
  if (km == null || !Number.isFinite(km)) {
    return null
  }
  const text = formatStraightLine(km)
  if (!text) {
    return null
  }
  return `${text} до следующей`
}

export function routeStopViews(stops: RouteStopInput[]): RouteStopView[] {
  const normalized = stops.map((stop) => ({
    href: stop.href,
    text: stop.text,
    note: stop.note?.trim() || null,
    latitude: finiteCoord(stop.latitude),
    longitude: finiteCoord(stop.longitude),
  }))
  return normalized.map((stop, index) => {
    const next = normalized[index + 1]
    const km = stop.latitude != null && stop.longitude != null && next?.latitude != null && next.longitude != null
      ? haversineKm(stop.latitude, stop.longitude, next.latitude, next.longitude)
      : null
    return { ...stop, distanceLabel: straightLineLabel(km) }
  })
}

export function locatedStops(stops: Array<Pick<RouteStopView, 'latitude' | 'longitude' | 'text'>>): RouteMapPoint[] {
  return stops.flatMap((stop, index) => {
    if (stop.latitude == null || stop.longitude == null) {
      return []
    }
    return [{
      latitude: stop.latitude,
      longitude: stop.longitude,
      label: String(index + 1),
      title: stop.text,
    }]
  })
}

// Yandex rtext is latitude,longitude. The JS API center is the opposite order.
export function yandexRouteUrl(points: RoutePoint[], mode: RouteTravelMode = 'auto') {
  const rtext = points.map((point) => pair(point)).join('~')
  return `https://yandex.ru/maps/?rtext=${rtext}&rtt=${mode}`
}

export function googleRouteUrl(points: RoutePoint[], mode: RouteTravelMode = 'auto') {
  const origin = points[0]
  const destination = points[points.length - 1]
  if (!origin || !destination) {
    return ''
  }
  const params = new URLSearchParams()
  params.set('api', '1')
  params.set('origin', pair(origin))
  params.set('destination', pair(destination))
  params.set('travelmode', GOOGLE_TRAVEL[mode])
  const via = points.slice(1, -1)
  if (via.length) {
    params.set('waypoints', via.map((point) => pair(point)).join('|'))
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function routeLinks(points: RoutePoint[], mode: RouteTravelMode = 'auto') {
  if (points.length < 2) {
    return null
  }
  return {
    yandex: yandexRouteUrl(points, mode),
    google: googleRouteUrl(points, mode),
  }
}
