import type { VenueKind } from '@k39/database'
import process from 'node:process'
import { db } from '@k39/database'
import { formatWalkingDistance, rankNearbyVenues, VENUE_NEARBY_RADIUS_KM, venueIsStale, venueKindMeta } from '../../../shared/venues'

export interface PublicNearbyVenue {
  slug: string
  href: string
  name: string
  kind: VenueKind
  kindLabel: string
  distanceKm: number
  distanceLabel: string
  partner: boolean
  stale: boolean
}

export function venueSponsorRankEnabled() {
  return process.env.FEATURE_VENUE_SPONSOR === 'true'
}

export async function nearbyVenues(origins: Array<{ latitude: number | null, longitude: number | null }>) {
  const points = origins.flatMap((item) => (
    item.latitude != null && item.longitude != null
      ? [{ latitude: item.latitude, longitude: item.longitude }]
      : []
  ))
  const rows = await db.venues.nearbyCandidates(points, VENUE_NEARBY_RADIUS_KM)
  return rankNearbyVenues(rows, venueSponsorRankEnabled()).map((row): PublicNearbyVenue => ({
    slug: row.slug,
    href: `/zavedeniya/${row.slug}`,
    name: row.name,
    kind: row.kind,
    kindLabel: venueKindMeta(row.kind).label,
    distanceKm: row.distanceKm,
    distanceLabel: formatWalkingDistance(row.distanceKm),
    partner: row.partner,
    stale: venueIsStale(row.lastVerifiedAt),
  }))
}
