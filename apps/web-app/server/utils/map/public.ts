import type { MapPoint, MapRoute } from '../../../shared/map'
import { db, isStale, kindHeading } from '@k39/database'
import { blurb, FOOD_FILTERS, isChurchPlace, normalizeRoutePath, partnerVisible, SIGHT_FACETS } from '../../../shared/map'
import { toPublicMedia } from '../../../shared/media'
import { collectionDocument } from '../../../shared/seo'
import { sponsoredVenuesEnabled } from '../venues/public'

function thumb(row: Parameters<typeof toPublicMedia>[0] | undefined) {
  if (!row) {
    return null
  }
  const media = toPublicMedia(row)
  const small = media.variants
    .filter((item) => item.format === 'webp')
    .sort((a, b) => a.width - b.width)[0]
  return small ? `/media/${media.id}/${small.file}` : media.src
}

export async function loadMap() {
  const [placeRows, venueRows, stopRows] = await Promise.all([
    db.content.mapPlaces(),
    db.venues.list({ status: 'published', foodOnly: true }),
    db.content.mapRouteStops(),
  ])
  const placeCovers = await db.content.coversFor(placeRows.map((row) => row.id))
  const venueIds = venueRows.map((row) => row.id)
  const [venueCovers, sponsored] = await Promise.all([
    db.venues.coversFor(venueIds),
    db.venues.sponsoredIds(venueIds),
  ])
  const stopCovers = await db.content.coversFor(stopRows.map((row) => row.placeId))
  const flag = sponsoredVenuesEnabled()
  const now = new Date()
  const points: MapPoint[] = []

  for (const row of placeRows) {
    if (row.latitude == null || row.longitude == null) {
      continue
    }
    const category = row.categorySlug || 'forty'
    const sight = SIGHT_FACETS.find((item) => item.id === category)
    const church = isChurchPlace(row.slug, row.title)
    if (category === 'eda') {
      points.push({
        id: `place:${row.id}`,
        group: 'food',
        slug: row.slug,
        title: row.title,
        href: `/${row.slug}`,
        latitude: row.latitude,
        longitude: row.longitude,
        category: 'eda',
        marker: 'eda',
        church: false,
        kindLabel: 'Еда',
        summary: blurb(row.summary),
        photo: thumb(placeCovers.get(row.id)),
        partner: false,
        stale: false,
      })
      continue
    }
    points.push({
      id: `place:${row.id}`,
      group: 'sight',
      slug: row.slug,
      title: row.title,
      href: `/${row.slug}`,
      latitude: row.latitude,
      longitude: row.longitude,
      category,
      marker: church ? 'tserkvi' : (sight?.id || 'forty'),
      church,
      kindLabel: church ? 'Церкви' : (row.categoryTitle || sight?.label || 'Место'),
      summary: blurb(row.summary),
      photo: thumb(placeCovers.get(row.id)),
      partner: false,
      stale: false,
    })
  }

  for (const row of venueRows) {
    if (row.noindex || row.latitude == null || row.longitude == null) {
      continue
    }
    const stale = isStale(row.lastVerifiedAt, now)
    points.push({
      id: `venue:${row.id}`,
      group: 'food',
      slug: row.slug,
      title: row.name,
      href: `/zavedeniya/${row.slug}`,
      latitude: row.latitude,
      longitude: row.longitude,
      category: row.kind,
      marker: FOOD_FILTERS.some((item) => item.id === row.kind) ? row.kind : 'other',
      church: false,
      kindLabel: kindHeading(row.kind),
      summary: blurb(row.address || row.description),
      photo: thumb(venueCovers.get(row.id)),
      partner: partnerVisible(flag, sponsored.has(row.id)),
      stale,
    })
  }

  const routes = new Map<string, MapRoute>()
  for (const row of stopRows) {
    let route = routes.get(row.routeSlug)
    if (!route) {
      route = {
        slug: row.routeSlug,
        title: row.routeTitle,
        href: `/marshruty/${row.routeSlug}`,
        stops: [],
        path: normalizeRoutePath(row.path),
      }
      routes.set(row.routeSlug, route)
    }
    route.stops.push({
      position: row.position,
      title: row.title,
      href: `/${row.slug}`,
      latitude: row.latitude ?? Number.NaN,
      longitude: row.longitude ?? Number.NaN,
      summary: blurb(row.summary, 90),
      photo: thumb(stopCovers.get(row.placeId)),
    })
  }

  const routeList = [...routes.values()].sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  const doc = collectionDocument({
    path: '/karta',
    h1: 'Карта Калининградской области',
    summary: 'Достопримечательности, где поесть и маршруты на одной карте Калининградской области.',
    items: [
      ...points.slice(0, 40).map((point) => ({ name: point.title, url: point.href })),
      ...routeList.map((route) => ({ name: route.title, url: route.href })),
    ],
    kind: 'CollectionPage',
  })

  return { doc, points, routes: routeList }
}
