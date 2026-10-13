import type { SourceLink, VenueHours, VenueKind, VenueSocials, VenueStatus } from '../types/entities'
import type { Venue } from '../types/tables'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { media, offers, regions, slugRedirects, venueListingIntros, venueMedia, venues } from '../tables'

const LIVE = ['published', 'closed'] as const

export interface VenueWrite {
  id?: string
  slug: string
  name: string
  kind: VenueKind
  cuisine?: string[]
  regionId?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  priceLevel?: number | null
  avgCheck?: number | null
  hours?: VenueHours
  phone?: string | null
  website?: string | null
  socials?: VenueSocials
  description?: string
  sources?: SourceLink[]
  status?: VenueStatus
  lastVerifiedAt?: string | null
  osmId?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  mediaIds?: string[]
}

export interface VenueOrigin {
  latitude: number
  longitude: number
}

export interface NearbyCandidate {
  id: string
  slug: string
  name: string
  kind: VenueKind
  distanceKm: number
  lastVerifiedAt: string | null
  sponsored: boolean
  description: string
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }
  return (result as { rows?: T[] }).rows ?? []
}

function uniqueViolation(error: unknown) {
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    if ('code' in current && (current as { code?: string }).code === '23505') {
      return true
    }
    current = 'cause' in current ? (current as { cause?: unknown }).cause : null
  }
  return false
}

async function upsertRedirect(fromPath: string, toPath: string) {
  const db = useDatabase()
  const [existing] = await db.select().from(slugRedirects).where(eq(slugRedirects.fromPath, fromPath)).limit(1)
  if (!existing) {
    await db.insert(slugRedirects).values({ fromPath, toPath, statusCode: 301 })
    return
  }
  await db.update(slugRedirects).set({ toPath, statusCode: 301 }).where(eq(slugRedirects.id, existing.id))
}

export class Venues {
  static async byId(id: string) {
    const [row] = await useDatabase().select().from(venues).where(eq(venues.id, id)).limit(1)
    return row ?? null
  }

  static async bySlug(slug: string) {
    const [row] = await useDatabase().select().from(venues).where(eq(venues.slug, slug)).limit(1)
    return row ?? null
  }

  static async detailBySlug(slug: string) {
    const row = await this.bySlug(slug)
    if (!row) {
      return null
    }
    const region = row.regionId
      ? (await useDatabase().select().from(regions).where(eq(regions.id, row.regionId)).limit(1))[0] ?? null
      : null
    const gallery = await this.galleryFor(row.id)
    return { venue: row, region, gallery }
  }

  static async regionBySlug(slug: string) {
    const [row] = await useDatabase().select().from(regions).where(eq(regions.slug, slug)).limit(1)
    return row ?? null
  }

  static async galleryFor(venueId: string) {
    return useDatabase().select({
      sortOrder: venueMedia.sortOrder,
      isCover: venueMedia.isCover,
      media,
    }).from(venueMedia).innerJoin(media, eq(venueMedia.mediaId, media.id)).where(eq(venueMedia.venueId, venueId)).orderBy(desc(venueMedia.isCover), asc(venueMedia.sortOrder))
  }

  static async attachMedia(venueId: string, mediaId: string, options?: { sortOrder?: number, isCover?: boolean }) {
    const db = useDatabase()
    const existing = await db.select().from(venueMedia).where(and(eq(venueMedia.venueId, venueId), eq(venueMedia.mediaId, mediaId))).limit(1)
    if (options?.isCover) {
      await db.update(venueMedia).set({ isCover: false }).where(eq(venueMedia.venueId, venueId))
    }
    if (existing[0]) {
      const [row] = await db.update(venueMedia).set({
        sortOrder: options?.sortOrder ?? existing[0].sortOrder,
        isCover: options?.isCover ?? existing[0].isCover,
      }).where(eq(venueMedia.id, existing[0].id)).returning()
      return row
    }
    const [countRow] = await db.select({ value: sql<number>`count(*)::int` }).from(venueMedia).where(eq(venueMedia.venueId, venueId))
    const [row] = await db.insert(venueMedia).values({
      venueId,
      mediaId,
      sortOrder: options?.sortOrder ?? countRow?.value ?? 0,
      isCover: options?.isCover ?? (countRow?.value ?? 0) === 0,
    }).returning()
    return row
  }

  static async replaceGallery(venueId: string, mediaIds: string[]) {
    const db = useDatabase()
    const unique = [...new Set(mediaIds.filter(Boolean))]
    await db.delete(venueMedia).where(eq(venueMedia.venueId, venueId))
    for (const [index, mediaId] of unique.entries()) {
      await db.insert(venueMedia).values({
        venueId,
        mediaId,
        sortOrder: index,
        isCover: index === 0,
      })
    }
  }

  static async save(data: VenueWrite) {
    const db = useDatabase()
    const existing = data.id ? await this.byId(data.id) : await this.bySlug(data.slug)
    const values = {
      slug: data.slug,
      name: data.name,
      kind: data.kind,
      cuisine: data.cuisine ?? [],
      regionId: data.regionId ?? null,
      address: data.address ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      priceLevel: data.priceLevel ?? null,
      avgCheck: data.avgCheck ?? null,
      hours: data.hours ?? {},
      phone: data.phone ?? null,
      website: data.website ?? null,
      socials: data.socials ?? {},
      description: data.description ?? '',
      sources: data.sources ?? [],
      status: data.status ?? 'draft' as VenueStatus,
      lastVerifiedAt: data.lastVerifiedAt ?? null,
      osmId: data.osmId ?? null,
      seoTitle: data.seoTitle ?? null,
      seoDescription: data.seoDescription ?? null,
      updatedAt: new Date().toISOString(),
    }
    try {
      if (existing) {
        if (existing.slug !== data.slug) {
          await upsertRedirect(`/zavedeniya/${existing.slug}`, `/zavedeniya/${data.slug}`)
        }
        const [updated] = await db.update(venues).set(values).where(eq(venues.id, existing.id)).returning()
        if (data.mediaIds) {
          await this.replaceGallery(existing.id, data.mediaIds)
        }
        return updated ?? existing
      }
      const [created] = await db.insert(venues).values(values).returning()
      if (!created) {
        throw new Error('Venue insert failed')
      }
      if (data.mediaIds?.length) {
        await this.replaceGallery(created.id, data.mediaIds)
      }
      return created
    } catch (error) {
      if (uniqueViolation(error)) {
        throw new Error('venue-conflict')
      }
      throw error
    }
  }

  static async list(input: {
    regionSlug?: string
    kind?: VenueKind
    status?: VenueStatus
    query?: string
    stale?: boolean
    near?: { latitude: number, longitude: number, radiusKm: number }
    page: number
    pageSize: number
  }) {
    const db = useDatabase()
    const filters = []
    if (input.regionSlug) {
      filters.push(eq(regions.slug, input.regionSlug))
    }
    if (input.kind) {
      filters.push(eq(venues.kind, input.kind))
    }
    if (input.status) {
      filters.push(eq(venues.status, input.status))
    }
    if (input.query) {
      const safe = `%${input.query.replace(/[%_\\]/g, '\\$&')}%`
      filters.push(sql`(${venues.name} ilike ${safe} or ${venues.slug} ilike ${safe})`)
    }
    if (input.stale === true) {
      filters.push(sql`(${venues.lastVerifiedAt} is null or ${venues.lastVerifiedAt} < now() - interval '180 days')`)
    }
    if (input.stale === false) {
      filters.push(sql`${venues.lastVerifiedAt} is not null and ${venues.lastVerifiedAt} >= now() - interval '180 days'`)
    }
    if (input.near) {
      filters.push(sql`${venues.latitude} is not null and ${venues.longitude} is not null and (
        6371 * acos(least(1::float8, greatest(-1::float8,
          cos(radians(${input.near.latitude})) * cos(radians(${venues.latitude})) * cos(radians(${venues.longitude}) - radians(${input.near.longitude}))
          + sin(radians(${input.near.latitude})) * sin(radians(${venues.latitude}))
        ))) <= ${input.near.radiusKm}
      )`)
    }
    const where = filters.length ? and(...filters) : undefined
    const rows = await db.select({
      id: venues.id,
      slug: venues.slug,
      name: venues.name,
      kind: venues.kind,
      status: venues.status,
      regionSlug: regions.slug,
      regionTitle: regions.title,
      lastVerifiedAt: venues.lastVerifiedAt,
      description: venues.description,
      latitude: venues.latitude,
      longitude: venues.longitude,
      updatedAt: venues.updatedAt,
    }).from(venues).leftJoin(regions, eq(venues.regionId, regions.id)).where(where).orderBy(asc(venues.name)).limit(input.pageSize).offset((input.page - 1) * input.pageSize)
    const [countRow] = await db.select({ value: sql<number>`count(*)::int` }).from(venues).leftJoin(regions, eq(venues.regionId, regions.id)).where(where)
    return { items: rows, total: countRow?.value ?? 0 }
  }

  static async listLive(filter: { regionId?: string | null, kind?: VenueKind | null }) {
    const db = useDatabase()
    const filters = [inArray(venues.status, [...LIVE])]
    if (filter.regionId) {
      filters.push(eq(venues.regionId, filter.regionId))
    }
    if (filter.kind) {
      filters.push(eq(venues.kind, filter.kind))
    }
    return db.select({
      id: venues.id,
      slug: venues.slug,
      name: venues.name,
      kind: venues.kind,
      status: venues.status,
      description: venues.description,
      address: venues.address,
      latitude: venues.latitude,
      longitude: venues.longitude,
      priceLevel: venues.priceLevel,
      avgCheck: venues.avgCheck,
      lastVerifiedAt: venues.lastVerifiedAt,
      regionSlug: regions.slug,
      regionTitle: regions.title,
    }).from(venues).leftJoin(regions, eq(venues.regionId, regions.id)).where(and(...filters)).orderBy(asc(venues.name))
  }

  static async liveRegions() {
    const result = await useDatabase().execute(sql`
      select distinct r.slug, r.title
      from venues v
      join regions r on r.id = v.region_id
      where v.status in ('published', 'closed')
      order by r.title
    `)
    return rowsOf<{ slug: string, title: string }>(result)
  }

  static async nearbyCandidates(origins: VenueOrigin[], radiusKm: number) {
    const points = origins.filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    if (!points.length) {
      return [] as NearbyCandidate[]
    }
    const originSql = sql.join(points.map((item) => sql`(${item.latitude}::float8, ${item.longitude}::float8)`), sql`, `)
    const result = await useDatabase().execute(sql`
      select id, slug, name, kind, last_verified_at, description, distance_km, sponsored
      from (
        select v.id, v.slug, v.name, v.kind, v.last_verified_at, v.description,
          min(6371 * acos(least(1::float8, greatest(-1::float8,
            cos(radians(o.lat)) * cos(radians(v.latitude)) * cos(radians(v.longitude) - radians(o.lng))
            + sin(radians(o.lat)) * sin(radians(v.latitude))
          )))) as distance_km,
          bool_or(exists (
            select 1 from offers ofr
            where ofr.venue_id = v.id and ofr.status = 'active'
          )) as sponsored
        from venues v
        cross join (values ${originSql}) as o(lat, lng)
        where v.status = 'published'
          and v.latitude is not null
          and v.longitude is not null
          and v.last_verified_at is not null
          and v.last_verified_at >= now() - interval '365 days'
        group by v.id
      ) nearest
      where distance_km <= ${radiusKm}
      order by distance_km asc
      limit 40
    `)
    return rowsOf<{
      id: string
      slug: string
      name: string
      kind: VenueKind
      last_verified_at: string | null
      description: string
      distance_km: number | string
      sponsored: boolean | string
    }>(result).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      distanceKm: Number(row.distance_km),
      lastVerifiedAt: row.last_verified_at,
      sponsored: row.sponsored === true || row.sponsored === 't' || row.sponsored === 'true',
      description: row.description,
    }))
  }

  static async existingOsmIds(ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))]
    if (!unique.length) {
      return new Set<string>()
    }
    const rows = await useDatabase().select({ osmId: venues.osmId }).from(venues).where(inArray(venues.osmId, unique))
    return new Set(rows.map((row) => row.osmId).filter((id): id is string => Boolean(id)))
  }

  static async slugs() {
    const rows = await useDatabase().select({ slug: venues.slug }).from(venues)
    return new Set(rows.map((row) => row.slug))
  }

  static async insertDrafts(rows: VenueWrite[]) {
    if (!rows.length) {
      return [] as Venue[]
    }
    const db = useDatabase()
    const created: Venue[] = []
    for (const row of rows) {
      try {
        const [inserted] = await db.insert(venues).values({
          slug: row.slug,
          name: row.name,
          kind: row.kind,
          cuisine: row.cuisine ?? [],
          regionId: row.regionId ?? null,
          address: row.address ?? null,
          latitude: row.latitude ?? null,
          longitude: row.longitude ?? null,
          priceLevel: row.priceLevel ?? null,
          avgCheck: row.avgCheck ?? null,
          hours: row.hours ?? {},
          phone: row.phone ?? null,
          website: row.website ?? null,
          socials: row.socials ?? {},
          description: row.description ?? '',
          sources: row.sources ?? [],
          status: 'draft',
          lastVerifiedAt: null,
          osmId: row.osmId ?? null,
        }).returning()
        if (inserted) {
          created.push(inserted)
        }
      } catch (error) {
        if (!uniqueViolation(error)) {
          throw error
        }
      }
    }
    return created
  }

  static async sponsoredIds(ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))]
    if (!unique.length) {
      return new Set<string>()
    }
    const rows = await useDatabase().select({ venueId: offers.venueId }).from(offers).where(and(
      inArray(offers.venueId, unique),
      eq(offers.status, 'active'),
    ))
    return new Set(rows.map((row) => row.venueId).filter((id): id is string => Boolean(id)))
  }

  static async listingIntro(regionSlug: string, kindSlug: string) {
    const [row] = await useDatabase().select().from(venueListingIntros).where(and(
      eq(venueListingIntros.regionSlug, regionSlug),
      eq(venueListingIntros.kindSlug, kindSlug),
    )).limit(1)
    return row ?? null
  }

  static async setListingIntro(regionSlug: string, kindSlug: string, intro: string) {
    const db = useDatabase()
    const existing = await this.listingIntro(regionSlug, kindSlug)
    if (existing) {
      const [row] = await db.update(venueListingIntros).set({
        intro,
        updatedAt: new Date().toISOString(),
      }).where(eq(venueListingIntros.id, existing.id)).returning()
      return row ?? existing
    }
    const [row] = await db.insert(venueListingIntros).values({ regionSlug, kindSlug, intro }).returning()
    return row!
  }

  static async sitemapRows() {
    const db = useDatabase()
    const venueRows = await db.select({
      slug: venues.slug,
      updatedAt: venues.updatedAt,
      name: venues.name,
      description: venues.description,
      status: venues.status,
      id: venues.id,
    }).from(venues).where(inArray(venues.status, [...LIVE]))
    const links = await db.select().from(venueMedia)
    const images = await db.select().from(media)
    const introRows = await db.select().from(venueListingIntros)
    const filters = await db.execute(sql`
      select r.slug as region_slug, v.kind, max(v.updated_at) as updated_at
      from venues v
      join regions r on r.id = v.region_id
      where v.status in ('published', 'closed')
        and length(btrim(v.description)) > 0
      group by r.slug, v.kind
    `)
    return {
      venues: venueRows.filter((row) => row.description.trim().length > 0).map((row) => ({
        loc: `/zavedeniya/${row.slug}`,
        lastmod: row.updatedAt,
        title: row.name,
        images: galleryFiles(row.id, images, links),
      })),
      filters: rowsOf<{ region_slug: string, kind: VenueKind, updated_at: string }>(filters),
      intros: introRows.filter((row) => row.intro.trim()).map((row) => ({
        regionSlug: row.regionSlug,
        kindSlug: row.kindSlug,
        updatedAt: row.updatedAt,
      })),
    }
  }
}

function galleryFiles(
  venueId: string,
  images: Array<{ id: string, filename: string, alt: string }>,
  links: Array<{ venueId: string, mediaId: string, isCover: boolean, sortOrder: number }>,
) {
  const byId = new Map(images.map((row) => [row.id, row]))
  return links
    .filter((link) => link.venueId === venueId)
    .sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.sortOrder - b.sortOrder)
    .flatMap((link) => {
      const image = byId.get(link.mediaId)
      if (!image) {
        return []
      }
      return [{ loc: `/media/${image.filename}`, title: image.alt }]
    })
}
