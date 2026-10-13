import type { MapPayload, MapPoint, MapQuery, MapRouteLine } from '../../../shared/embed-map'
import type { MediaVariant } from '../../../shared/media'
import { db, kindLabel } from '@k39/database'
import { mapDistanceLabel, pinOffer, shortMapText, WALKING_RADIUS_KM } from '../../../shared/embed-map'
import { toPublicMedia } from '../../../shared/media'
import { sponsoredVenuesEnabled } from '../venues/public'

function photoOf(row: { id: string, filename: string, alt: string, width: number | null, height: number | null, variants?: unknown }) {
  const media = toPublicMedia({
    id: row.id,
    filename: row.filename,
    alt: row.alt,
    width: row.width,
    height: row.height,
    variants: Array.isArray(row.variants) ? row.variants as MediaVariant[] : [],
  })
  if (!media.src) {
    return null
  }
  return { src: media.src, alt: media.alt || '' }
}

function placePoint(row: {
  id: string
  slug: string
  title: string
  summary: string
  latitude: number
  longitude: number
  categorySlug: string | null
  categoryTitle: string | null
  distanceKm: number | null
}, photo: MapPoint['photo']): MapPoint {
  return {
    id: row.id,
    layer: 'place',
    kind: row.categorySlug || 'place',
    title: row.title,
    typeLabel: row.categoryTitle || 'Место',
    href: `/${row.slug}`,
    latitude: row.latitude,
    longitude: row.longitude,
    summary: shortMapText(row.summary),
    distanceKm: row.distanceKm,
    distance: mapDistanceLabel(row.distanceKm),
    photo,
    partner: false,
    offer: null,
    label: '',
  }
}

function venuePoint(row: {
  id: string
  slug: string
  name: string
  kind: string
  address: string | null
  description: string
  latitude: number
  longitude: number
  distanceKm: number | null
}, photo: MapPoint['photo'], offer: { title: string, terms: string } | undefined, enabled: boolean): MapPoint {
  const text = [offer?.title, offer?.terms].filter(Boolean).join('. ')
  const sponsor = pinOffer({ partner: Boolean(offer), offer: text || null }, enabled)
  return {
    id: row.id,
    layer: 'venue',
    kind: row.kind,
    title: row.name,
    typeLabel: kindLabel(row.kind),
    href: `/zavedeniya/${row.slug}`,
    latitude: row.latitude,
    longitude: row.longitude,
    summary: shortMapText(row.description || row.address || ''),
    distanceKm: row.distanceKm,
    distance: mapDistanceLabel(row.distanceKm),
    photo,
    partner: sponsor.partner,
    offer: sponsor.offer ? shortMapText(sponsor.offer, 180) : null,
    label: '',
  }
}

interface RouteStopRow {
  routeSlug: string
  routeTitle: string
  placeId: string
  placeSlug: string
  placeTitle: string
  summary: string
  note: string | null
  latitude: number | null
  longitude: number | null
  categorySlug: string | null
  categoryTitle: string | null
}

function groupRoutes(stops: RouteStopRow[]) {
  const groups = new Map<string, RouteStopRow[]>()
  for (const stop of stops) {
    const list = groups.get(stop.routeSlug) ?? []
    list.push(stop)
    groups.set(stop.routeSlug, list)
  }
  return [...groups.entries()].map(([slug, rows]) => {
    const located = rows.filter((row) => row.latitude != null && row.longitude != null)
    const line: MapRouteLine = {
      slug,
      title: rows[0]?.routeTitle || slug,
      href: `/marshruty/${slug}`,
      stops: located.map((row, index) => ({
        latitude: row.latitude as number,
        longitude: row.longitude as number,
        label: String(index + 1),
        href: `/${row.placeSlug}`,
        title: row.placeTitle,
      })),
    }
    return { rows: located, line }
  })
}

export async function loadMap(query: MapQuery): Promise<MapPayload> {
  const enabled = sponsoredVenuesEnabled()
  const catalog = query.scope === 'catalog'
  let origins: Array<{ latitude: number, longitude: number }> = []
  let routeSlug: string | null = null
  if (!catalog && query.route) {
    routeSlug = query.route
    const stops = await db.map.routeStops(routeSlug)
    origins = stops.flatMap((stop) => {
      if (stop.latitude == null || stop.longitude == null) {
        return []
      }
      return [{ latitude: stop.latitude, longitude: stop.longitude }]
    })
  } else if (!catalog && query.latitude != null && query.longitude != null) {
    origins = [{ latitude: query.latitude, longitude: query.longitude }]
  }
  const radiusKm = catalog ? null : query.radiusKm || WALKING_RADIUS_KM
  const limit = catalog ? 800 : 80
  const [placeRows, venueRows, routeRows] = await Promise.all([
    db.map.places({ origins: catalog ? [] : origins, radiusKm, limit }),
    db.map.venues({ origins: catalog ? [] : origins, radiusKm, limit }),
    catalog ? db.map.routeStops(null) : routeSlug ? db.map.routeStops(routeSlug) : Promise.resolve([]),
  ])
  const grouped = groupRoutes(routeRows)
  const stopIds = new Set(catalog ? [] : grouped.flatMap((group) => group.rows.map((row) => row.placeId)))
  const placeIds = placeRows.map((row) => row.id)
  const venueIds = venueRows.map((row) => row.id)
  const [placeCovers, venueCovers, offers] = await Promise.all([
    db.content.coversFor([...placeIds, ...stopIds]),
    db.venues.coversFor(venueIds),
    enabled ? db.map.activeOffers(venueIds) : Promise.resolve(new Map<string, { title: string, terms: string }>()),
  ])
  const points: MapPoint[] = [
    ...placeRows
      .filter((row) => !stopIds.has(row.id))
      .map((row) => placePoint(row, photoOfCover(placeCovers.get(row.id)))),
    ...venueRows.map((row) => venuePoint(row, photoOfCover(venueCovers.get(row.id)), offers.get(row.id), enabled)),
  ]
  if (!catalog && routeSlug) {
    for (const group of grouped) {
      group.rows.forEach((row, index) => {
        if (row.latitude == null || row.longitude == null) {
          return
        }
        const distanceKm = origins.length
          ? minDistance(row.latitude, row.longitude, origins)
          : null
        points.push({
          ...placePoint({
            id: row.placeId,
            slug: row.placeSlug,
            title: row.placeTitle,
            summary: row.note?.trim() || row.summary,
            latitude: row.latitude,
            longitude: row.longitude,
            categorySlug: row.categorySlug,
            categoryTitle: row.categoryTitle,
            distanceKm,
          }, photoOfCover(placeCovers.get(row.placeId))),
          layer: 'route',
          label: String(index + 1),
          typeLabel: row.categoryTitle || 'Остановка',
        })
      })
    }
  }
  return {
    sponsored: enabled,
    walkingKm: WALKING_RADIUS_KM,
    points,
    routes: grouped.map((group) => group.line).filter((line) => line.stops.length > 0),
  }
}

function photoOfCover(row: { id: string, filename: string, alt: string, width: number | null, height: number | null, variants?: unknown } | undefined) {
  if (!row) {
    return null
  }
  return photoOf(row)
}

function minDistance(latitude: number, longitude: number, origins: Array<{ latitude: number, longitude: number }>) {
  let best = Number.POSITIVE_INFINITY
  for (const origin of origins) {
    const km = haversine(latitude, longitude, origin.latitude, origin.longitude)
    if (km < best) {
      best = km
    }
  }
  return Number.isFinite(best) ? best : null
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (value: number) => value * Math.PI / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}
