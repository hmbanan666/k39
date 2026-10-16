import { sql } from 'drizzle-orm'
import { useDatabase } from '../database'

export interface MapOrigin {
  latitude: number
  longitude: number
}

export interface MapPlaceRow {
  id: string
  slug: string
  title: string
  summary: string
  latitude: number
  longitude: number
  categorySlug: string | null
  categoryTitle: string | null
  distanceKm: number | null
}

export interface MapVenueRow {
  id: string
  slug: string
  name: string
  kind: string
  address: string | null
  description: string
  latitude: number
  longitude: number
  distanceKm: number | null
}

export interface MapRouteStopRow {
  routeSlug: string
  routeTitle: string
  placeId: string
  placeSlug: string
  placeTitle: string
  summary: string
  note: string | null
  latitude: number | null
  longitude: number | null
  position: number
  categorySlug: string | null
  categoryTitle: string | null
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }
  return (result as { rows?: T[] }).rows ?? []
}

function numArray(values: number[]) {
  return sql`array[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::float8[]`
}

function distanceSql(lat: ReturnType<typeof sql>, lng: ReturnType<typeof sql>, origins: MapOrigin[]) {
  return sql`(
    select min(6371 * acos(least(1::float8, greatest(-1::float8,
      cos(radians(o.lat)) * cos(radians(${lat})) * cos(radians(${lng}) - radians(o.lng))
      + sin(radians(o.lat)) * sin(radians(${lat}))
    ))))
    from unnest(${numArray(origins.map((point) => point.latitude))}, ${numArray(origins.map((point) => point.longitude))}) as o(lat, lng)
  )`
}

/** Fact coordinates when that row exists, otherwise the column. */
function pointFrom(alias: 'p' | 'v', subject: 'place' | 'venue') {
  const id = sql.raw(`${alias}.id`)
  const latitude = () => sql`case when coord.fact_id is not null then coord.latitude else ${sql.raw(`${alias}.latitude`)} end`
  const longitude = () => sql`case when coord.fact_id is not null then coord.longitude else ${sql.raw(`${alias}.longitude`)} end`
  const fact = sql`left join lateral (
    select f.id as fact_id,
      (f.value->>'latitude')::float8 as latitude,
      (f.value->>'longitude')::float8 as longitude
    from facts f
    where f.subject_type = ${subject}
      and f.subject_id = ${id}
      and f.kind = 'coordinates'
      and f.slot = 'coordinates'
      and f.retired_at is null
    limit 1
  ) coord on true`
  return { latitude, longitude, fact }
}

export class MapCatalog {
  static async places(input: { origins: MapOrigin[], radiusKm: number | null, limit: number }) {
    const limit = Math.max(1, Math.min(800, Math.floor(input.limit)))
    const nearby = input.origins.length > 0 && input.radiusKm != null
    const point = pointFrom('p', 'place')
    const distance = nearby ? distanceSql(point.latitude(), point.longitude(), input.origins) : sql`null::float8`
    const where = nearby ? sql`where distance_km <= ${input.radiusKm}` : sql``
    const order = nearby ? sql`order by distance_km asc` : sql`order by title asc`
    const result = await useDatabase().execute(sql`
      select * from (
        select p.id, p.slug, p.title, p.summary,
          ${point.latitude()} as latitude,
          ${point.longitude()} as longitude,
          c.slug as category_slug, c.title as category_title,
          ${distance} as distance_km
        from places p
        ${point.fact}
        left join categories c on c.id = p.category_id
        where p.publication_status = 'published'
          and ${point.latitude()} is not null
          and ${point.longitude()} is not null
      ) points
      ${where}
      ${order}
      limit ${limit}
    `)
    return rowsOf<{
      id: string
      slug: string
      title: string
      summary: string
      latitude: number
      longitude: number
      category_slug: string | null
      category_title: string | null
      distance_km: number | null
    }>(result).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary || '',
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      categorySlug: row.category_slug,
      categoryTitle: row.category_title,
      distanceKm: row.distance_km == null ? null : Number(row.distance_km),
    }))
  }

  static async venues(input: { origins: MapOrigin[], radiusKm: number | null, limit: number }) {
    const limit = Math.max(1, Math.min(800, Math.floor(input.limit)))
    const nearby = input.origins.length > 0 && input.radiusKm != null
    const point = pointFrom('v', 'venue')
    const distance = nearby ? distanceSql(point.latitude(), point.longitude(), input.origins) : sql`null::float8`
    const where = nearby ? sql`where distance_km <= ${input.radiusKm}` : sql``
    const order = nearby ? sql`order by distance_km asc` : sql`order by name asc`
    const result = await useDatabase().execute(sql`
      select * from (
        select v.id, v.slug, v.name, v.kind, v.address, v.description,
          ${point.latitude()} as latitude,
          ${point.longitude()} as longitude,
          ${distance} as distance_km
        from venues v
        ${point.fact}
        where v.status = 'published'
          and ${point.latitude()} is not null
          and ${point.longitude()} is not null
      ) points
      ${where}
      ${order}
      limit ${limit}
    `)
    return rowsOf<{
      id: string
      slug: string
      name: string
      kind: string
      address: string | null
      description: string
      latitude: number
      longitude: number
      distance_km: number | null
    }>(result).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      address: row.address,
      description: row.description || '',
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      distanceKm: row.distance_km == null ? null : Number(row.distance_km),
    }))
  }

  static async routeStops(slug: string | null) {
    const slugClause = slug ? sql`and r.slug = ${slug}` : sql``
    const result = await useDatabase().execute(sql`
      select r.slug as route_slug, r.title as route_title,
        p.id as place_id, p.slug as place_slug, p.title as place_title, p.summary,
        rp.note, rp.position, p.latitude, p.longitude,
        c.slug as category_slug, c.title as category_title
      from routes r
      join route_points rp on rp.route_id = r.id
      join places p on p.id = rp.place_id and p.publication_status = 'published'
      left join categories c on c.id = p.category_id
      where r.publication_status = 'published'
        ${slugClause}
      order by r.title asc, rp.position asc
    `)
    return rowsOf<{
      route_slug: string
      route_title: string
      place_id: string
      place_slug: string
      place_title: string
      summary: string
      note: string | null
      position: number
      latitude: number | null
      longitude: number | null
      category_slug: string | null
      category_title: string | null
    }>(result).map((row) => ({
      routeSlug: row.route_slug,
      routeTitle: row.route_title,
      placeId: row.place_id,
      placeSlug: row.place_slug,
      placeTitle: row.place_title,
      summary: row.summary || '',
      note: row.note,
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
      position: Number(row.position),
      categorySlug: row.category_slug,
      categoryTitle: row.category_title,
    }))
  }

  static async activeOffers(venueIds: string[]) {
    const ids = [...new Set(venueIds.filter(Boolean))]
    const found = new Map<string, { title: string, terms: string }>()
    if (!ids.length) {
      return found
    }
    const result = await useDatabase().execute(sql`
      select distinct on (venue_id) venue_id, title, terms
      from offers
      where status = 'active'
        and venue_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
      order by venue_id, updated_at desc
    `)
    for (const row of rowsOf<{ venue_id: string, title: string, terms: string }>(result)) {
      found.set(row.venue_id, { title: row.title, terms: row.terms })
    }
    return found
  }
}
