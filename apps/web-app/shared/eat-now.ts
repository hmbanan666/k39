import { regionArea } from './region'

// «Где поесть сейчас» (ADR 0029). The server sends every published venue of
// a catalogue area in distance order; the browser only adds the live status and the
// grouping, so search engines and people get the same list.

export const EAT_NOW_PATH = '/gde-poest-seychas'

export type EatNowGroup = 'open' | 'later' | 'unknown'

export const EAT_NOW_GROUPS: Array<{ key: EatNowGroup, title: string }> = [
  { key: 'open', title: 'Открыто сейчас' },
  { key: 'later', title: 'Откроется позже' },
  { key: 'unknown', title: 'Часы не проверены' },
]

// Legacy helper name retained for callers; every phrase describes a catalogue area.
export function inTown(slug: string, label: string) {
  return regionArea({ slug, title: label, shortTitle: label }).inside
}

export function eatNowPath(regionSlug?: string | null) {
  return regionSlug ? `${EAT_NOW_PATH}/${regionSlug}` : EAT_NOW_PATH
}

export function haversineKm(a: { latitude: number, longitude: number }, b: { latitude: number, longitude: number }) {
  const rad = Math.PI / 180
  const dLat = (b.latitude - a.latitude) * rad
  const dLng = (b.longitude - a.longitude) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Group by live status, keep distance order inside each group. */
export function groupEatNow<T extends { distanceKm: number | null }>(items: T[], groupOf: (item: T) => EatNowGroup) {
  const sorted = [...items].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
  return EAT_NOW_GROUPS
    .map((group) => ({ ...group, items: sorted.filter((item) => groupOf(item) === group.key) }))
    .filter((group) => group.items.length)
}

// Browser copies of formatVenueDistance/formatWalk from @k39/database, used
// after geolocation. A test keeps them equal.
export function clientDistance(km: number) {
  if (km < 1) {
    return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} м`
  }
  if (km < 10) {
    return `${(Math.round(km * 10) / 10).toFixed(1).replace('.', ',')} км`
  }
  return `${Math.round(km)} км`
}

export function clientWalk(km: number) {
  const minutes = Math.max(1, Math.round((km * 1.3 / 4.5) * 60))
  return minutes <= 30 ? `~${minutes} мин пешком` : ''
}
