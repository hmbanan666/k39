import type { BodySection } from '../body-sections'
import type { PlaceDraft } from '../types'
import type { CollectionKind, MediaLicense, MediaStatus, MediaVariant, PublicationStatus, SourceLink, StoredPageModule, VisitStatus } from '../types/entities'
import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { composeBody, readSections, splitBody } from '../body-sections'
import { useDatabase } from '../database'
import { firstPublishedStamp } from '../first-published'
import { REDIRECT_HOP_LIMIT } from '../redirects'
import { prepareSourceLinks, SourceInputError } from '../sources'
import { categories, collectionItems, collectionMedia, collections, contentDrafts, facts, mcpAudits, media, offers, placeMedia, places, quests, questSteps, regions, relatedLinks, revisions, routePoints, routes, slugRedirects, venueListingIntros, venueMedia, venues } from '../tables'
import { descriptionLength, isFoodKind, kindPath, LISTING_INTRO_MIN } from '../venues'

const published = 'published' as const

/**
 * Keeps body and sections in step (ADR 0027): given sections, the body is
 * composed from them; given only a body, it is split into sections.
 */
function syncedBody(data: { body?: string, sections?: unknown }): { body?: string, sections?: BodySection[] } {
  if (data.sections !== undefined) {
    const sections = readSections(data.sections)
    return { sections, body: composeBody(sections) }
  }
  if (data.body !== undefined) {
    const sections = splitBody(data.body)
    return { sections, body: composeBody(sections) }
  }
  return {}
}

export type ContentTx = Parameters<Parameters<ReturnType<typeof useDatabase>['transaction']>[0]>[0]

/** Cap, dedupe, and validate source rows. The same rules as a venue. */
function pageSources(rows: unknown): SourceLink[] {
  if (rows == null) {
    return []
  }
  if (!Array.isArray(rows)) {
    throw new SourceInputError('Источники: нужен список')
  }
  return prepareSourceLinks(rows) ?? []
}

function kept<T>(payload: Record<string, unknown>, key: string, fallback: T): T {
  if (!Object.hasOwn(payload, key)) {
    return fallback
  }
  return payload[key] as T
}

function routeFromPending(existing: typeof routes.$inferSelect, payload: Record<string, unknown>) {
  const slug = typeof payload.slug === 'string' && payload.slug ? payload.slug : existing.slug
  const title = typeof payload.title === 'string' && payload.title ? payload.title : existing.title
  const next = {
    slug,
    title,
    summary: kept(payload, 'summary', existing.summary),
    body: kept(payload, 'body', existing.body),
    seoTitle: kept(payload, 'seoTitle', existing.seoTitle),
    seoDescription: kept(payload, 'seoDescription', existing.seoDescription),
    ogImage: kept(payload, 'ogImage', existing.ogImage),
    noindex: kept(payload, 'noindex', existing.noindex),
    publicationStatus: 'published' as const,
  }
  const sections = Object.hasOwn(payload, 'sections') ? { sections: payload.sections } : {}
  return { ...next, ...syncedBody({ ...next, ...sections }) }
}

function collectionFromPending(existing: typeof collections.$inferSelect, payload: Record<string, unknown>) {
  const slug = typeof payload.slug === 'string' && payload.slug ? payload.slug : existing.slug
  const title = typeof payload.title === 'string' && payload.title ? payload.title : existing.title
  return {
    slug,
    title,
    summary: kept(payload, 'summary', existing.summary),
    body: kept(payload, 'body', existing.body),
    seoTitle: kept(payload, 'seoTitle', existing.seoTitle),
    seoDescription: kept(payload, 'seoDescription', existing.seoDescription),
    ogImage: kept(payload, 'ogImage', existing.ogImage),
    noindex: kept(payload, 'noindex', existing.noindex),
    kind: kept(payload, 'kind', existing.kind),
    month: kept(payload, 'month', existing.month),
    sources: kept(payload, 'sources', existing.sources),
    modules: kept(payload, 'modules', existing.modules),
    publicationStatus: 'published' as const,
  }
}

async function withPendingDraft<T>(
  entityType: string,
  entityId: string,
  apply: (tx: ContentTx, draft: typeof contentDrafts.$inferSelect) => Promise<T | null>,
) {
  return useDatabase().transaction(async (tx) => {
    const [draft] = await tx.select().from(contentDrafts).where(and(
      eq(contentDrafts.entityType, entityType),
      eq(contentDrafts.entityId, entityId),
    )).limit(1).for('update')
    if (!draft) {
      return null
    }
    const result = await apply(tx, draft)
    if (!result) {
      return null
    }
    await tx.delete(contentDrafts).where(eq(contentDrafts.id, draft.id))
    return result
  })
}

/**
 * Live columns plus the pending payload. Sections are included only when the
 * draft stored them, so a body-only draft is split on save instead of being
 * overwritten by the live sections.
 */
function placeFromPending(existing: typeof places.$inferSelect, payload: Record<string, unknown>) {
  const slug = typeof payload.slug === 'string' && payload.slug ? payload.slug : existing.slug
  const title = typeof payload.title === 'string' && payload.title ? payload.title : existing.title
  const next = {
    slug,
    title,
    summary: kept(payload, 'summary', existing.summary),
    body: kept(payload, 'body', existing.body),
    status: kept(payload, 'status', existing.status),
    hours: kept(payload, 'hours', existing.hours),
    price: kept(payload, 'price', existing.price),
    howToGet: kept(payload, 'howToGet', existing.howToGet),
    latitude: kept(payload, 'latitude', existing.latitude),
    longitude: kept(payload, 'longitude', existing.longitude),
    categoryId: kept(payload, 'categoryId', existing.categoryId),
    regionId: kept(payload, 'regionId', existing.regionId),
    sources: Object.hasOwn(payload, 'sources') ? pageSources(payload.sources) : existing.sources,
    seoTitle: kept(payload, 'seoTitle', existing.seoTitle),
    seoDescription: kept(payload, 'seoDescription', existing.seoDescription),
    ogImage: kept(payload, 'ogImage', existing.ogImage),
    noindex: kept(payload, 'noindex', existing.noindex),
    visitDuration: kept(payload, 'visitDuration', existing.visitDuration),
    bestTime: kept(payload, 'bestTime', existing.bestTime),
    faq: kept(payload, 'faq', existing.faq),
    lastVerifiedAt: kept(payload, 'lastVerifiedAt', existing.lastVerifiedAt),
    authorKind: kept(payload, 'authorKind', existing.authorKind),
    publicationStatus: 'published' as const,
  }
  const sections = Object.hasOwn(payload, 'sections') ? { sections: payload.sections } : {}
  return { ...next, ...syncedBody({ ...next, ...sections }) }
}

export class Content {
  /**
   * Rows along one redirect chain, oldest hop first. A path with no row is one
   * indexed read and an empty list. Stops on a miss, a 410, a repeated path, or
   * REDIRECT_HOP_LIMIT hops, matching followRedirects in the web app.
   */
  static async redirectChain(startPath: string, hopLimit = REDIRECT_HOP_LIMIT) {
    const hops = Math.min(REDIRECT_HOP_LIMIT, Math.max(1, Math.floor(hopLimit)))
    const rows: Array<{ fromPath: string, toPath: string | null, statusCode: number }> = []
    const seen = new Set<string>()
    let current = startPath
    for (let hop = 0; hop < hops; hop++) {
      if (seen.has(current)) {
        break
      }
      const row = await redirectByPath(current)
      if (!row) {
        break
      }
      rows.push(row)
      seen.add(current)
      if (row.statusCode === 410 || !row.toPath) {
        break
      }
      current = row.toPath
    }
    return rows
  }

  static async categories() {
    return useDatabase().select().from(categories).orderBy(asc(categories.title))
  }

  static async categoryBySlug(slug: string) {
    const [row] = await useDatabase().select().from(categories).where(eq(categories.slug, slug)).limit(1)
    return row
  }

  static async publishedPlacesByCategory(categoryId: string) {
    return useDatabase().select().from(places).where(and(
      eq(places.categoryId, categoryId),
      eq(places.publicationStatus, published),
    )).orderBy(asc(places.title))
  }

  static async publishedPlace(slug: string) {
    const db = useDatabase()
    const [place] = await db.select().from(places).where(and(
      eq(places.slug, slug),
      eq(places.publicationStatus, published),
    )).limit(1)
    if (!place) {
      return null
    }
    const [category] = place.categoryId
      ? await db.select().from(categories).where(eq(categories.id, place.categoryId)).limit(1)
      : []
    const [region] = place.regionId
      ? await db.select().from(regions).where(eq(regions.id, place.regionId)).limit(1)
      : []
    const gallery = await Content.galleryFor(place.id)
    const images = gallery.map((item) => item.media)
    const nearest = place.latitude != null && place.longitude != null
      ? await this.nearest(place.latitude, place.longitude, place.slug, 6)
      : []
    const sameRegion = place.regionId
      ? await db.select({ slug: places.slug, title: places.title }).from(places).where(and(
          eq(places.regionId, place.regionId),
          eq(places.publicationStatus, published),
          ne(places.id, place.id),
        )).orderBy(asc(places.title)).limit(6)
      : []
    const routeRows = await db.select({ slug: routes.slug, title: routes.title }).from(routePoints).innerJoin(routes, eq(routePoints.routeId, routes.id)).where(and(eq(routePoints.placeId, place.id), eq(routes.publicationStatus, published)))
    const collectionRows = await db.select({ slug: collections.slug, title: collections.title }).from(collectionItems).innerJoin(collections, eq(collectionItems.collectionId, collections.id)).where(and(eq(collectionItems.placeId, place.id), eq(collections.publicationStatus, published)))
    const related = await db.select({ slug: places.slug, title: places.title, anchor: relatedLinks.anchor }).from(relatedLinks).innerJoin(places, eq(relatedLinks.toPlaceId, places.id)).where(and(eq(relatedLinks.fromPlaceId, place.id), eq(places.publicationStatus, published))).orderBy(asc(relatedLinks.position))
    return { place, category, region, images, gallery, nearest, sameRegion, routeRows, collectionRows, related }
  }

  static async collectionGallery(collectionId: string) {
    return useDatabase().select({
      sortOrder: collectionMedia.sortOrder,
      isCover: collectionMedia.isCover,
      media,
    }).from(collectionMedia).innerJoin(media, eq(collectionMedia.mediaId, media.id)).where(and(eq(collectionMedia.collectionId, collectionId), eq(media.status, 'ready'))).orderBy(desc(collectionMedia.isCover), asc(collectionMedia.sortOrder))
  }

  static async galleryFor(placeId: string) {
    const db = useDatabase()
    const linked = await db.select({
      sortOrder: placeMedia.sortOrder,
      isCover: placeMedia.isCover,
      media,
    }).from(placeMedia).innerJoin(media, eq(placeMedia.mediaId, media.id)).where(eq(placeMedia.placeId, placeId)).orderBy(desc(placeMedia.isCover), asc(placeMedia.sortOrder))
    if (linked.length) {
      return linked
    }
    const legacy = await db.select().from(media).where(eq(media.placeId, placeId)).orderBy(asc(media.sortOrder))
    return legacy.map((item, index) => ({
      sortOrder: item.sortOrder,
      isCover: index === 0,
      media: item,
    }))
  }

  static async coversFor(placeIds: string[]) {
    const ids = placeIds.filter(Boolean)
    const map = new Map<string, typeof media.$inferSelect>()
    if (!ids.length) {
      return map
    }
    const db = useDatabase()
    const links = await db.select().from(placeMedia).where(inArray(placeMedia.placeId, ids)).orderBy(desc(placeMedia.isCover), asc(placeMedia.sortOrder))
    const mediaIds = [...new Set(links.map((link) => link.mediaId))]
    const rows = mediaIds.length
      ? await db.select().from(media).where(inArray(media.id, mediaIds))
      : []
    const byId = new Map(rows.map((row) => [row.id, row]))
    for (const link of links) {
      const row = byId.get(link.mediaId)
      if (row && !map.has(link.placeId)) {
        map.set(link.placeId, row)
      }
    }
    const missing = ids.filter((id) => !map.has(id))
    if (missing.length) {
      const legacy = await db.select().from(media).where(inArray(media.placeId, missing)).orderBy(asc(media.sortOrder))
      for (const row of legacy) {
        if (row.placeId && !map.has(row.placeId)) {
          map.set(row.placeId, row)
        }
      }
    }
    return map
  }

  static async mediaByIds(ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))]
    if (!unique.length) {
      return []
    }
    return useDatabase().select().from(media).where(inArray(media.id, unique))
  }

  static async nearest(lat: number, lng: number, excludeSlug: string, limit: number) {
    const result = await useDatabase().execute(sql`
      select p.slug, p.title, c.slug as category_slug,
        p.id as place_id,
        (select m.filename from media m where m.place_id = p.id order by m.sort_order asc limit 1) as image_filename,
        (select m.alt from media m where m.place_id = p.id order by m.sort_order asc limit 1) as image_alt,
        (select m.width from media m where m.place_id = p.id order by m.sort_order asc limit 1) as image_width,
        (select m.height from media m where m.place_id = p.id order by m.sort_order asc limit 1) as image_height,
        (6371 * acos(least(1::float8, greatest(-1::float8,
          cos(radians(${lat})) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(${lng}))
          + sin(radians(${lat})) * sin(radians(p.latitude))
        )))) as distance_km
      from places p
      left join categories c on c.id = p.category_id
      where p.publication_status = 'published'
        and p.slug <> ${excludeSlug}
        and p.latitude is not null
        and p.longitude is not null
      order by distance_km asc
      limit ${limit}
    `)
    type NearestRow = {
      place_id: string
      slug: string
      title: string
      distance_km: number
      category_slug: string | null
      image_filename: string | null
      image_alt: string | null
      image_width: number | null
      image_height: number | null
    }
    const rows = Array.isArray(result)
      ? result as NearestRow[]
      : (result as unknown as { rows?: NearestRow[] }).rows
    return rows ?? []
  }

  static async listPublishedRoutes() {
    return useDatabase().select().from(routes).where(eq(routes.publicationStatus, published)).orderBy(asc(routes.title))
  }

  static async publishedRoute(slug: string) {
    const db = useDatabase()
    const [route] = await db.select().from(routes).where(and(eq(routes.slug, slug), eq(routes.publicationStatus, published))).limit(1)
    if (!route) {
      return null
    }
    const points = await db.select({
      slug: places.slug,
      title: places.title,
      note: routePoints.note,
      position: routePoints.position,
      latitude: places.latitude,
      longitude: places.longitude,
    }).from(routePoints).innerJoin(places, eq(routePoints.placeId, places.id)).where(and(eq(routePoints.routeId, route.id), eq(places.publicationStatus, published))).orderBy(asc(routePoints.position))
    return { route, points }
  }

  static async mapPlaces() {
    const latitude = () => sql<number>`case when ${facts.id} is not null then (${facts.value}->>'latitude')::float8 else ${places.latitude} end`
    const longitude = () => sql<number>`case when ${facts.id} is not null then (${facts.value}->>'longitude')::float8 else ${places.longitude} end`
    return useDatabase().select({
      id: places.id,
      slug: places.slug,
      title: places.title,
      summary: places.summary,
      latitude: latitude(),
      longitude: longitude(),
      categorySlug: categories.slug,
      categoryTitle: categories.title,
      hours: places.hours,
    }).from(places).leftJoin(categories, eq(places.categoryId, categories.id)).leftJoin(facts, and(
      eq(facts.subjectType, 'place'),
      eq(facts.subjectId, places.id),
      eq(facts.kind, 'coordinates'),
      eq(facts.slot, 'coordinates'),
      isNull(facts.retiredAt),
    )).where(and(
      eq(places.publicationStatus, published),
      eq(places.noindex, false),
      sql`${latitude()} is not null`,
      sql`${longitude()} is not null`,
    )).orderBy(asc(places.title))
  }

  static async mapRouteStops() {
    return useDatabase().select({
      routeSlug: routes.slug,
      routeTitle: routes.title,
      routeSummary: routes.summary,
      path: routes.path,
      position: routePoints.position,
      placeId: places.id,
      slug: places.slug,
      title: places.title,
      summary: places.summary,
      latitude: places.latitude,
      longitude: places.longitude,
    }).from(routePoints).innerJoin(routes, eq(routePoints.routeId, routes.id)).innerJoin(places, eq(routePoints.placeId, places.id)).where(and(
      eq(routes.publicationStatus, published),
      eq(routes.noindex, false),
      eq(places.publicationStatus, published),
    )).orderBy(asc(routes.title), asc(routePoints.position))
  }

  static async listPublishedCollections() {
    return useDatabase().select().from(collections).where(eq(collections.publicationStatus, published)).orderBy(asc(collections.title))
  }

  static async publishedCollection(slug: string) {
    const db = useDatabase()
    const [collection] = await db.select().from(collections).where(and(eq(collections.slug, slug), eq(collections.publicationStatus, published))).limit(1)
    if (!collection) {
      return null
    }
    const items = await db.select({
      id: places.id,
      slug: places.slug,
      title: places.title,
      summary: places.summary,
      note: collectionItems.note,
      position: collectionItems.position,
      categorySlug: categories.slug,
      categoryTitle: categories.title,
      regionTitle: regions.title,
    }).from(collectionItems).innerJoin(places, eq(collectionItems.placeId, places.id)).leftJoin(categories, eq(places.categoryId, categories.id)).leftJoin(regions, eq(places.regionId, regions.id)).where(and(eq(collectionItems.collectionId, collection.id), eq(places.publicationStatus, published))).orderBy(asc(collectionItems.position))
    return { collection, items }
  }

  static async listPublishedQuests() {
    return useDatabase().select().from(quests).where(eq(quests.publicationStatus, published)).orderBy(asc(quests.title))
  }

  static async publishedQuest(slug: string) {
    const db = useDatabase()
    const [quest] = await db.select().from(quests).where(and(eq(quests.slug, slug), eq(quests.publicationStatus, published))).limit(1)
    if (!quest) {
      return null
    }
    const steps = await db.select({
      slug: places.slug,
      title: questSteps.title,
      prompt: questSteps.prompt,
      position: questSteps.position,
      placeId: places.id,
      categorySlug: categories.slug,
    }).from(questSteps).innerJoin(places, eq(questSteps.placeId, places.id)).leftJoin(categories, eq(places.categoryId, categories.id)).where(and(eq(questSteps.questId, quest.id), eq(places.publicationStatus, published))).orderBy(asc(questSteps.position))
    let route: { slug: string, title: string } | null = null
    if (quest.routeId) {
      const [linked] = await db.select({ slug: routes.slug, title: routes.title }).from(routes).where(and(
        eq(routes.id, quest.routeId),
        eq(routes.publicationStatus, published),
      )).limit(1)
      route = linked ?? null
    }
    return { quest, steps, route }
  }

  static async sitemapRows() {
    const db = useDatabase()
    const visible = and(eq(places.publicationStatus, published), eq(places.noindex, false))
    const placeRows = await db.select({
      slug: places.slug,
      updatedAt: places.updatedAt,
      title: places.title,
      id: places.id,
    }).from(places).where(visible)
    const images = await db.select().from(media)
    const links = await db.select().from(placeMedia)
    const routeRows = await db.select({ slug: routes.slug, updatedAt: routes.updatedAt }).from(routes).where(and(eq(routes.publicationStatus, published), eq(routes.noindex, false)))
    const collectionRows = await db.select({ slug: collections.slug, updatedAt: collections.updatedAt }).from(collections).where(and(eq(collections.publicationStatus, published), eq(collections.noindex, false)))
    const questRows = await db.select({ slug: quests.slug, updatedAt: quests.updatedAt }).from(quests).where(and(eq(quests.publicationStatus, published), eq(quests.noindex, false)))
    const venueRows = await db.select({
      id: venues.id,
      slug: venues.slug,
      updatedAt: venues.updatedAt,
      description: venues.description,
      noindex: venues.noindex,
    }).from(venues).where(eq(venues.status, 'published'))
    const venuePhotoLinks = await db.select({
      venueId: venueMedia.venueId,
      mediaId: venueMedia.mediaId,
    }).from(venueMedia)
    const introRows = await db.select({
      body: venueListingIntros.body,
      updatedAt: venueListingIntros.updatedAt,
      kind: venueListingIntros.kind,
      regionSlug: regions.slug,
    }).from(venueListingIntros).leftJoin(regions, eq(venueListingIntros.regionId, regions.id))
    return {
      places: placeRows.map((row) => ({
        loc: `/${row.slug}`,
        lastmod: row.updatedAt,
        title: row.title,
        images: galleryImages(row.id, images, links).map((image) => ({
          loc: mediaPublicPath(image),
          title: image.alt,
        })),
      })),
      routes: routeRows.map((row) => ({ loc: `/marshruty/${row.slug}`, lastmod: row.updatedAt })),
      collections: collectionRows.map((row) => ({ loc: `/podborki/${row.slug}`, lastmod: row.updatedAt })),
      quests: questRows.map((row) => ({ loc: `/kvesty/${row.slug}`, lastmod: row.updatedAt })),
      venues: venueRows
        .filter((row) => !row.noindex && descriptionLength(row.description) > 0)
        .map((row) => ({
          loc: `/zavedeniya/${row.slug}`,
          lastmod: row.updatedAt,
          images: imagesForIds(venuePhotoLinks.filter((link) => link.venueId === row.id).map((link) => link.mediaId), images).map((image) => ({
            loc: mediaPublicPath(image),
            title: image.alt,
          })),
        })),
      venueListings: introRows.flatMap((row) => {
        if (descriptionLength(row.body) < LISTING_INTRO_MIN) {
          return []
        }
        if (row.kind && !isFoodKind(row.kind)) {
          return []
        }
        const regionSlug = row.regionSlug
        const kind = row.kind ? kindPath(row.kind) : null
        if (row.kind && !regionSlug && !kind) {
          return []
        }
        const loc = ['/zavedeniya', regionSlug, kind].filter(Boolean).join('/')
        if (loc === '/zavedeniya') {
          return []
        }
        return [{ loc, lastmod: row.updatedAt }]
      }),
    }
  }

  static async relatedFor(placeId: string) {
    return useDatabase().select({
      slug: places.slug,
      title: places.title,
      anchor: relatedLinks.anchor,
    }).from(relatedLinks).innerJoin(places, eq(relatedLinks.toPlaceId, places.id)).where(and(
      eq(relatedLinks.fromPlaceId, placeId),
      eq(places.publicationStatus, published),
    )).orderBy(asc(relatedLinks.position))
  }

  static async activeOffers(placeId: string) {
    return useDatabase().select({
      title: offers.title,
      terms: offers.terms,
    }).from(offers).where(and(eq(offers.placeId, placeId), eq(offers.status, 'active')))
  }
}

export class Editor {
  static async listPlaces() {
    return useDatabase().select().from(places).orderBy(asc(places.title))
  }

  static async searchPlaces(input: {
    categorySlug?: string
    regionSlug?: string
    publicationStatus?: PublicationStatus
    visitStatus?: VisitStatus
    query?: string
    page: number
    pageSize: number
  }) {
    const db = useDatabase()
    const filters = []
    if (input.categorySlug) {
      filters.push(eq(categories.slug, input.categorySlug))
    }
    if (input.regionSlug) {
      filters.push(eq(regions.slug, input.regionSlug))
    }
    if (input.publicationStatus) {
      filters.push(eq(places.publicationStatus, input.publicationStatus))
    }
    if (input.visitStatus) {
      filters.push(eq(places.status, input.visitStatus))
    }
    if (input.query) {
      const safe = `%${input.query.replace(/[%_\\]/g, '\\$&')}%`
      filters.push(sql`(${places.title} ilike ${safe} or ${places.slug} ilike ${safe} or ${places.summary} ilike ${safe})`)
    }
    const where = filters.length ? and(...filters) : undefined
    const rows = await db.select({
      id: places.id,
      slug: places.slug,
      title: places.title,
      summary: places.summary,
      status: places.status,
      publicationStatus: places.publicationStatus,
      categorySlug: categories.slug,
      regionSlug: regions.slug,
    }).from(places).leftJoin(categories, eq(places.categoryId, categories.id)).leftJoin(regions, eq(places.regionId, regions.id)).where(where).orderBy(asc(places.title)).limit(input.pageSize).offset((input.page - 1) * input.pageSize)
    const [countRow] = await db.select({ value: sql<number>`count(*)::int` }).from(places).leftJoin(categories, eq(places.categoryId, categories.id)).leftJoin(regions, eq(places.regionId, regions.id)).where(where)
    return { items: rows, total: countRow?.value ?? 0 }
  }

  static async contentDraft(entityType: string, entityId: string) {
    const [row] = await useDatabase().select().from(contentDrafts).where(and(
      eq(contentDrafts.entityType, entityType),
      eq(contentDrafts.entityId, entityId),
    )).limit(1)
    return row ?? null
  }

  static async saveContentDraft(input: {
    entityType: string
    entityId: string
    publicationStatus: 'draft' | 'review'
    payload: Record<string, unknown>
  }) {
    const db = useDatabase()
    const existing = await this.contentDraft(input.entityType, input.entityId)
    if (existing) {
      const [row] = await db.update(contentDrafts).set({
        publicationStatus: input.publicationStatus,
        payload: input.payload,
        updatedAt: new Date().toISOString(),
      }).where(eq(contentDrafts.id, existing.id)).returning()
      return row ?? existing
    }
    const [row] = await db.insert(contentDrafts).values(input).returning()
    if (!row) {
      throw new Error('Content draft insert failed')
    }
    return row
  }

  static async deleteContentDraft(entityType: string, entityId: string) {
    await useDatabase().delete(contentDrafts).where(and(
      eq(contentDrafts.entityType, entityType),
      eq(contentDrafts.entityId, entityId),
    ))
  }

  static async contentDraftEntityIds(entityType: string) {
    const rows = await useDatabase().select({ entityId: contentDrafts.entityId }).from(contentDrafts).where(eq(contentDrafts.entityType, entityType))
    return rows.map((row) => row.entityId)
  }

  static async contentDraftsFor(entityType: string) {
    return useDatabase().select().from(contentDrafts).where(eq(contentDrafts.entityType, entityType))
  }

  /** Rejects a stop whose place slug does not exist. Does not write. */
  static async assertOrderedStops(stops: OrderedStop[]) {
    await resolveStops(stops)
  }

  /** The live row after `applyPendingPlace` would write this payload. */
  static pendingPlaceNext(existing: typeof places.$inferSelect, payload: Record<string, unknown>) {
    return placeFromPending(existing, payload)
  }

  /** Columns `applyPendingRoute` would write. Points stay on the payload. */
  static pendingRouteNext(existing: typeof routes.$inferSelect, payload: Record<string, unknown>) {
    const next = routeFromPending(existing, payload)
    const path = Object.hasOwn(payload, 'path')
      ? { path: payload.path as [number, number][] | null }
      : { path: existing.path }
    return { ...next, ...path }
  }

  /** Columns `applyPendingCollection` would write. Items stay on the payload. */
  static pendingCollectionNext(existing: typeof collections.$inferSelect, payload: Record<string, unknown>) {
    return collectionFromPending(existing, payload)
  }

  /**
   * Writes a pending place draft onto the live row and removes the draft
   * in one transaction (ADR 0035). Null when that draft is already gone.
   */
  static async applyPendingPlace(id: string) {
    return withPendingDraft('place', id, async (tx, draft) => {
      const [existing] = await tx.select().from(places).where(eq(places.id, id)).limit(1)
      if (!existing) {
        return null
      }
      const next = placeFromPending(existing, draft.payload)
      await tx.insert(revisions).values({
        entityType: 'place',
        entityId: existing.id,
        snapshot: existing,
        updatedBy: null,
      })
      if (existing.slug !== next.slug) {
        await upsertRedirect(`/${existing.slug}`, `/${next.slug}`, tx)
      }
      const [updated] = await tx.update(places).set({
        ...next,
        firstPublishedAt: firstPublishedStamp(existing.firstPublishedAt, 'published'),
        updatedBy: null,
        updatedAt: new Date().toISOString(),
      }).where(eq(places.id, existing.id)).returning()
      return updated ?? null
    })
  }

  /**
   * Writes a pending route draft, its ordered stops, and a slug redirect,
   * then removes the draft, in one transaction (ADR 0041).
   */
  static async applyPendingRoute(id: string) {
    return withPendingDraft('route', id, async (tx, draft) => {
      const [existing] = await tx.select().from(routes).where(eq(routes.id, id)).limit(1)
      if (!existing) {
        return null
      }
      const next = routeFromPending(existing, draft.payload)
      await tx.insert(revisions).values({
        entityType: 'route',
        entityId: existing.id,
        snapshot: existing,
        updatedBy: null,
      })
      if (existing.slug !== next.slug) {
        await upsertRedirect(`/marshruty/${existing.slug}`, `/marshruty/${next.slug}`, tx)
      }
      const path = Object.hasOwn(draft.payload, 'path')
        ? { path: draft.payload.path as [number, number][] | null }
        : {}
      const [updated] = await tx.update(routes).set({
        ...next,
        ...path,
        firstPublishedAt: firstPublishedStamp(existing.firstPublishedAt, 'published'),
        updatedBy: null,
        updatedAt: new Date().toISOString(),
      }).where(eq(routes.id, existing.id)).returning()
      if (!updated) {
        return null
      }
      if (Array.isArray(draft.payload.points)) {
        const resolved = await resolveStops(draft.payload.points as OrderedStop[], tx)
        await writeRoutePoints(updated.id, resolved, tx)
      }
      await syncGonePath(`/marshruty/${updated.slug}`, 'published', tx)
      return updated
    })
  }

  /**
   * Writes a pending collection draft, its ordered items, and a slug redirect,
   * then removes the draft, in one transaction (ADR 0041).
   */
  static async applyPendingCollection(id: string) {
    return withPendingDraft('collection', id, async (tx, draft) => {
      const [existing] = await tx.select().from(collections).where(eq(collections.id, id)).limit(1)
      if (!existing) {
        return null
      }
      const next = collectionFromPending(existing, draft.payload)
      await tx.insert(revisions).values({
        entityType: 'collection',
        entityId: existing.id,
        snapshot: existing,
        updatedBy: null,
      })
      if (existing.slug !== next.slug) {
        await upsertRedirect(`/podborki/${existing.slug}`, `/podborki/${next.slug}`, tx)
      }
      const [updated] = await tx.update(collections).set({
        ...next,
        firstPublishedAt: firstPublishedStamp(existing.firstPublishedAt, 'published'),
        updatedBy: null,
        updatedAt: new Date().toISOString(),
      }).where(eq(collections.id, existing.id)).returning()
      if (!updated) {
        return null
      }
      if (Array.isArray(draft.payload.items)) {
        const resolved = await resolveStops(draft.payload.items as OrderedStop[], tx)
        await writeCollectionItems(updated.id, resolved, tx)
      }
      await syncGonePath(`/podborki/${updated.slug}`, 'published', tx)
      return updated
    })
  }

  static async recordMcpAudit(data: { tool: string, entityType?: string | null, entityId?: string | null }) {
    const [row] = await useDatabase().insert(mcpAudits).values({
      actor: 'mcp',
      tool: data.tool,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
    }).returning({ id: mcpAudits.id })
    return row
  }

  static async placeById(id: string) {
    const [row] = await useDatabase().select().from(places).where(eq(places.id, id)).limit(1)
    return row
  }

  static async placeBySlug(slug: string) {
    const [row] = await useDatabase().select().from(places).where(eq(places.slug, slug)).limit(1)
    return row
  }

  static async savePlace(input: PlaceDraft & { slug: string }, userId?: string | null) {
    const data = { ...input, ...syncedBody(input) }
    if (input.sources !== undefined) {
      data.sources = pageSources(input.sources)
    }
    const db = useDatabase()
    const existing = data.id ? await this.placeById(data.id) : await this.placeBySlug(data.slug)
    if (existing) {
      await db.insert(revisions).values({
        entityType: 'place',
        entityId: existing.id,
        snapshot: existing,
        updatedBy: userId ?? null,
      })
      if (existing.slug !== data.slug) {
        await upsertRedirect(`/${existing.slug}`, `/${data.slug}`)
      }
      const status = data.publicationStatus ?? existing.publicationStatus
      const [updated] = await db.update(places).set({
        ...data,
        firstPublishedAt: firstPublishedStamp(existing.firstPublishedAt, status),
        updatedBy: userId ?? null,
        updatedAt: new Date().toISOString(),
      }).where(eq(places.id, existing.id)).returning()
      return updated ?? existing
    }
    const [created] = await db.insert(places).values({
      ...data,
      firstPublishedAt: firstPublishedStamp(null, data.publicationStatus ?? 'draft'),
      updatedBy: userId ?? null,
    }).returning()
    if (!created) {
      throw new Error('Place insert failed')
    }
    return created
  }

  static async listRoutes() {
    return useDatabase().select().from(routes).orderBy(asc(routes.title))
  }

  static async routeById(id: string) {
    const [row] = await useDatabase().select().from(routes).where(eq(routes.id, id)).limit(1)
    return row ?? null
  }

  /** The route that owns a stop. A missing point is null. */
  static async routeForPoint(pointId: string) {
    const [point] = await useDatabase().select({ routeId: routePoints.routeId }).from(routePoints).where(eq(routePoints.id, pointId)).limit(1)
    if (!point) {
      return null
    }
    return this.routeById(point.routeId)
  }

  static async routePoints(routeId: string) {
    return useDatabase().select({
      placeSlug: places.slug,
      title: places.title,
      note: routePoints.note,
      position: routePoints.position,
    }).from(routePoints).innerJoin(places, eq(routePoints.placeId, places.id)).where(eq(routePoints.routeId, routeId)).orderBy(asc(routePoints.position))
  }

  static async listQuests() {
    return useDatabase().select().from(quests).orderBy(asc(quests.title))
  }

  static async questById(id: string) {
    const [row] = await useDatabase().select().from(quests).where(eq(quests.id, id)).limit(1)
    return row
  }

  static async questBySlug(slug: string) {
    const [row] = await useDatabase().select().from(quests).where(eq(quests.slug, slug)).limit(1)
    return row
  }

  static async questStepsFor(questId: string) {
    return useDatabase().select({
      slug: places.slug,
      title: questSteps.title,
      prompt: questSteps.prompt,
      position: questSteps.position,
    }).from(questSteps).innerJoin(places, eq(questSteps.placeId, places.id)).where(eq(questSteps.questId, questId)).orderBy(asc(questSteps.position))
  }

  static async listCollections() {
    return useDatabase().select().from(collections).orderBy(asc(collections.title))
  }

  static async collectionById(id: string) {
    const [row] = await useDatabase().select().from(collections).where(eq(collections.id, id)).limit(1)
    return row ?? null
  }

  static transaction<T>(run: (tx: ContentTx) => Promise<T>) {
    return useDatabase().transaction(run)
  }

  /** Deletes the draft only when it is still the row the caller checked. */
  static async deleteContentDraftIfUnchanged(id: string, updatedAt: string, tx: ContentTx) {
    await tx.delete(contentDrafts).where(and(
      eq(contentDrafts.id, id),
      eq(contentDrafts.updatedAt, updatedAt),
    ))
  }

  static async collectionItems(collectionId: string) {
    return useDatabase().select({
      placeSlug: places.slug,
      title: places.title,
      note: collectionItems.note,
      position: collectionItems.position,
    }).from(collectionItems).innerJoin(places, eq(collectionItems.placeId, places.id)).where(eq(collectionItems.collectionId, collectionId)).orderBy(asc(collectionItems.position))
  }

  static async listRegions() {
    return useDatabase().select().from(regions).orderBy(asc(regions.title))
  }

  static async regionById(id: string) {
    const [row] = await useDatabase().select().from(regions).where(eq(regions.id, id)).limit(1)
    return row ?? null
  }

  /** Published place whose slug is the town (the town hub), for a short cover. */
  static async publishedPlacesForSlugs(slugs: string[]) {
    const unique = [...new Set(slugs.filter(Boolean))]
    if (!unique.length) {
      return []
    }
    return useDatabase().select({
      id: places.id,
      slug: places.slug,
      categorySlug: categories.slug,
    }).from(places).leftJoin(categories, eq(places.categoryId, categories.id)).where(and(
      inArray(places.slug, unique),
      eq(places.publicationStatus, published),
    ))
  }

  static async saveRoute(input: { id?: string, slug: string, title: string, summary?: string | null, body?: string, sections?: unknown, publicationStatus?: PublicationStatus, seoTitle?: string | null, seoDescription?: string | null, ogImage?: string | null, noindex?: boolean, points?: OrderedStop[], path?: [number, number][] | null }, userId?: string | null, tx?: ContentTx) {
    const data = { ...input, ...syncedBody(input) }
    const resolvedPoints = data.points ? await resolveStops(data.points, tx) : null
    const db = tx ?? useDatabase()
    const [existing] = data.id
      ? await db.select().from(routes).where(eq(routes.id, data.id)).limit(1)
      : await db.select().from(routes).where(eq(routes.slug, data.slug)).limit(1)
    if (existing && existing.slug !== data.slug) {
      await upsertRedirect(`/marshruty/${existing.slug}`, `/marshruty/${data.slug}`, tx)
    }
    const values = {
      slug: data.slug,
      title: data.title,
      summary: data.summary ?? existing?.summary ?? null,
      body: data.body ?? existing?.body ?? '',
      ...(data.sections !== undefined ? { sections: data.sections as BodySection[] } : {}),
      publicationStatus: data.publicationStatus ?? existing?.publicationStatus ?? 'draft',
      firstPublishedAt: firstPublishedStamp(existing?.firstPublishedAt, data.publicationStatus ?? existing?.publicationStatus ?? 'draft'),
      seoTitle: data.seoTitle ?? existing?.seoTitle ?? null,
      seoDescription: data.seoDescription ?? existing?.seoDescription ?? null,
      ogImage: data.ogImage ?? existing?.ogImage ?? null,
      noindex: data.noindex ?? existing?.noindex ?? false,
      updatedBy: userId ?? null,
      updatedAt: new Date().toISOString(),
      ...(data.path !== undefined ? { path: data.path } : {}),
    }
    const row = existing
      ? (await db.update(routes).set(values).where(eq(routes.id, existing.id)).returning())[0] ?? existing
      : (await db.insert(routes).values(values).returning())[0]
    if (!row) {
      throw new Error('Route insert failed')
    }
    if (resolvedPoints) {
      await writeRoutePoints(row.id, resolvedPoints, tx)
    }
    await syncGonePath(`/marshruty/${row.slug}`, row.publicationStatus, tx)
    return row
  }

  static async saveCollection(data: { id?: string, slug: string, title: string, summary?: string | null, body?: string, publicationStatus?: PublicationStatus, seoTitle?: string | null, seoDescription?: string | null, ogImage?: string | null, noindex?: boolean, items?: OrderedStop[], kind?: CollectionKind, month?: number | null, sources?: SourceLink[], modules?: StoredPageModule[] }, userId?: string | null, tx?: ContentTx) {
    const sources = data.sources === undefined ? undefined : pageSources(data.sources)
    const resolvedItems = data.items ? await resolveStops(data.items, tx) : null
    const db = tx ?? useDatabase()
    const [existing] = data.id
      ? await db.select().from(collections).where(eq(collections.id, data.id)).limit(1)
      : await db.select().from(collections).where(eq(collections.slug, data.slug)).limit(1)
    if (existing && existing.slug !== data.slug) {
      await upsertRedirect(`/podborki/${existing.slug}`, `/podborki/${data.slug}`, tx)
    }
    const values = {
      slug: data.slug,
      title: data.title,
      summary: data.summary ?? existing?.summary ?? null,
      body: data.body ?? existing?.body ?? '',
      publicationStatus: data.publicationStatus ?? existing?.publicationStatus ?? 'draft',
      firstPublishedAt: firstPublishedStamp(existing?.firstPublishedAt, data.publicationStatus ?? existing?.publicationStatus ?? 'draft'),
      seoTitle: data.seoTitle ?? existing?.seoTitle ?? null,
      seoDescription: data.seoDescription ?? existing?.seoDescription ?? null,
      ogImage: data.ogImage ?? existing?.ogImage ?? null,
      noindex: data.noindex ?? existing?.noindex ?? false,
      kind: data.kind ?? existing?.kind ?? 'theme',
      month: data.month !== undefined ? data.month : existing?.month ?? null,
      sources: sources === undefined ? existing?.sources ?? [] : sources,
      modules: data.modules ?? existing?.modules ?? [],
      updatedBy: userId ?? null,
      updatedAt: new Date().toISOString(),
    }
    const row = existing
      ? (await db.update(collections).set(values).where(eq(collections.id, existing.id)).returning())[0] ?? existing
      : (await db.insert(collections).values(values).returning())[0]
    if (!row) {
      throw new Error('Collection insert failed')
    }
    if (resolvedItems) {
      await writeCollectionItems(row.id, resolvedItems, tx)
    }
    await syncGonePath(`/podborki/${row.slug}`, row.publicationStatus, tx)
    return row
  }

  static async archiveOrDeleteRoute(id: string) {
    const db = useDatabase()
    const [row] = await db.select().from(routes).where(eq(routes.id, id)).limit(1)
    if (!row) {
      return null
    }
    if (row.publicationStatus === 'draft') {
      const [quest] = await db.select({ id: quests.id }).from(quests).where(eq(quests.routeId, row.id)).limit(1)
      if (quest) {
        throw new Error('Cannot delete: a quest still links this route')
      }
      const [offer] = await db.select({ id: offers.id }).from(offers).where(eq(offers.routeId, row.id)).limit(1)
      if (offer) {
        throw new Error('Cannot delete: an offer still links this route')
      }
      await db.delete(routes).where(eq(routes.id, row.id))
      return { action: 'deleted' as const, id: row.id, slug: row.slug, publicationStatus: null }
    }
    const [updated] = await db.update(routes).set({
      publicationStatus: 'archived',
      updatedAt: new Date().toISOString(),
    }).where(eq(routes.id, row.id)).returning()
    await markGone(`/marshruty/${row.slug}`)
    return {
      action: 'archived' as const,
      id: row.id,
      slug: row.slug,
      publicationStatus: updated?.publicationStatus ?? 'archived',
    }
  }

  static async archiveOrDeleteCollection(id: string) {
    const db = useDatabase()
    const [row] = await db.select().from(collections).where(eq(collections.id, id)).limit(1)
    if (!row) {
      return null
    }
    if (row.publicationStatus === 'draft') {
      await db.delete(collections).where(eq(collections.id, row.id))
      return { action: 'deleted' as const, id: row.id, slug: row.slug, publicationStatus: null }
    }
    const [updated] = await db.update(collections).set({
      publicationStatus: 'archived',
      updatedAt: new Date().toISOString(),
    }).where(eq(collections.id, row.id)).returning()
    await markGone(`/podborki/${row.slug}`)
    return {
      action: 'archived' as const,
      id: row.id,
      slug: row.slug,
      publicationStatus: updated?.publicationStatus ?? 'archived',
    }
  }

  static async saveQuest(data: {
    id?: string
    slug: string
    title: string
    summary?: string | null
    body?: string
    publicationStatus?: PublicationStatus
    seoTitle?: string | null
    seoDescription?: string | null
    ogImage?: string | null
    noindex?: boolean
    routeId?: string | null
    steps?: Array<{ placeSlug: string, title: string, prompt?: string | null }>
  }, userId?: string | null) {
    const db = useDatabase()
    const [existing] = data.id
      ? await db.select().from(quests).where(eq(quests.id, data.id)).limit(1)
      : await db.select().from(quests).where(eq(quests.slug, data.slug)).limit(1)
    if (existing && existing.slug !== data.slug) {
      await upsertRedirect(`/kvesty/${existing.slug}`, `/kvesty/${data.slug}`)
    }
    const values = {
      slug: data.slug,
      title: data.title,
      summary: data.summary ?? existing?.summary ?? null,
      body: data.body ?? existing?.body ?? '',
      publicationStatus: data.publicationStatus ?? existing?.publicationStatus ?? 'draft',
      firstPublishedAt: firstPublishedStamp(existing?.firstPublishedAt, data.publicationStatus ?? existing?.publicationStatus ?? 'draft'),
      seoTitle: data.seoTitle ?? existing?.seoTitle ?? null,
      seoDescription: data.seoDescription ?? existing?.seoDescription ?? null,
      ogImage: data.ogImage ?? existing?.ogImage ?? null,
      noindex: data.noindex ?? existing?.noindex ?? false,
      routeId: data.routeId === undefined ? existing?.routeId ?? null : data.routeId,
      updatedBy: userId ?? null,
      updatedAt: new Date().toISOString(),
    }
    const row = existing
      ? (await db.update(quests).set(values).where(eq(quests.id, existing.id)).returning())[0] ?? existing
      : (await db.insert(quests).values(values).returning())[0]
    if (!row) {
      throw new Error('Quest insert failed')
    }
    if (data.steps) {
      await db.delete(questSteps).where(eq(questSteps.questId, row.id))
      let position = 1
      for (const step of data.steps) {
        const [place] = await db.select({ id: places.id }).from(places).where(eq(places.slug, step.placeSlug)).limit(1)
        if (!place) {
          throw new Error(`Place not found: ${step.placeSlug}`)
        }
        await db.insert(questSteps).values({
          questId: row.id,
          placeId: place.id,
          position,
          title: step.title,
          prompt: step.prompt ?? null,
        })
        position += 1
      }
    }
    return row
  }

  static async saveCategory(id: string, data: { title: string, description: string, body?: string, seoTitle?: string | null, seoDescription?: string | null, ogImage?: string | null, noindex?: boolean }) {
    const [updated] = await useDatabase().update(categories).set({
      title: data.title,
      description: data.description,
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...(data.seoTitle !== undefined ? { seoTitle: data.seoTitle } : {}),
      ...(data.seoDescription !== undefined ? { seoDescription: data.seoDescription } : {}),
      ...(data.ogImage !== undefined ? { ogImage: data.ogImage } : {}),
      ...(data.noindex !== undefined ? { noindex: data.noindex } : {}),
      updatedAt: new Date().toISOString(),
    }).where(eq(categories.id, id)).returning()
    return updated
  }

  static async saveRegion(id: string, data: { title: string, description?: string | null }) {
    const [updated] = await useDatabase().update(regions).set({
      title: data.title,
      description: data.description ?? null,
      updatedAt: new Date().toISOString(),
    }).where(eq(regions.id, id)).returning()
    return updated
  }

  // Insert by slug, or update the existing row. Omitted center fields stay as stored.
  static async upsertRegion(data: {
    slug: string
    title: string
    shortTitle?: string | null
    description?: string | null
    latitude?: number | null
    longitude?: number | null
  }) {
    const db = useDatabase()
    const [existing] = await db.select().from(regions).where(eq(regions.slug, data.slug)).limit(1)
    const title = data.title.trim()
    if (!existing) {
      const [created] = await db.insert(regions).values({
        slug: data.slug,
        title,
        shortTitle: data.shortTitle?.trim() || null,
        description: data.description ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      }).returning()
      if (!created) {
        throw new Error('Region insert failed')
      }
      return created
    }
    const [updated] = await db.update(regions).set({
      title: title || existing.title,
      shortTitle: data.shortTitle === undefined ? existing.shortTitle : data.shortTitle?.trim() || null,
      description: data.description === undefined ? existing.description : data.description,
      latitude: data.latitude === undefined ? existing.latitude : data.latitude,
      longitude: data.longitude === undefined ? existing.longitude : data.longitude,
      updatedAt: new Date().toISOString(),
    }).where(eq(regions.id, existing.id)).returning()
    return updated ?? existing
  }

  static async listAllMedia() {
    return useDatabase().select().from(media).orderBy(asc(media.createdAt))
  }

  static async mediaForPlaceSource(placeId: string, urls: string[]) {
    const wanted = urls.filter(Boolean)
    if (!wanted.length) {
      return undefined
    }
    const [row] = await useDatabase().select({ media }).from(placeMedia).innerJoin(media, eq(placeMedia.mediaId, media.id)).where(and(
      eq(placeMedia.placeId, placeId),
      inArray(media.sourceUrl, wanted),
    )).limit(1)
    return row?.media
  }

  static async mediaById(id: string) {
    const [row] = await useDatabase().select().from(media).where(eq(media.id, id)).limit(1)
    return row
  }

  static async updateMedia(id: string, data: Partial<{
    filename: string
    mime: string
    bytes: number
    width: number | null
    height: number | null
    alt: string
    credit: string | null
    sourceUrl: string | null
    placeId: string | null
    sortOrder: number
    status: MediaStatus
    variants: MediaVariant[]
    lqip: string | null
    dominantColor: string | null
    focalX: number
    focalY: number
    license: MediaLicense | null
    author: string | null
    caption: string | null
  }>) {
    const [row] = await useDatabase().update(media).set({
      ...data,
      updatedAt: new Date().toISOString(),
    }).where(eq(media.id, id)).returning()
    return row
  }

  static async deleteMedia(id: string) {
    await useDatabase().delete(media).where(eq(media.id, id))
  }

  /**
   * Rejected uploads used to be inserted as failed rows with zero bytes.
   * A missing master on a real photo stays failed (media-rebuild) and is kept.
   */
  static async deleteFailedUploads() {
    return useDatabase().delete(media).where(and(eq(media.status, 'failed'), eq(media.bytes, 0))).returning({ id: media.id })
  }

  static async attachMedia(placeId: string, mediaId: string, options?: { sortOrder?: number, isCover?: boolean }) {
    const db = useDatabase()
    const existing = await db.select().from(placeMedia).where(and(eq(placeMedia.placeId, placeId), eq(placeMedia.mediaId, mediaId))).limit(1)
    if (options?.isCover) {
      await db.update(placeMedia).set({ isCover: false }).where(eq(placeMedia.placeId, placeId))
    }
    if (existing[0]) {
      const [row] = await db.update(placeMedia).set({
        sortOrder: options?.sortOrder ?? existing[0].sortOrder,
        isCover: options?.isCover ?? existing[0].isCover,
      }).where(eq(placeMedia.id, existing[0].id)).returning()
      return row
    }
    const [countRow] = await db.select({ value: sql<number>`count(*)::int` }).from(placeMedia).where(eq(placeMedia.placeId, placeId))
    const [row] = await db.insert(placeMedia).values({
      placeId,
      mediaId,
      sortOrder: options?.sortOrder ?? countRow?.value ?? 0,
      isCover: options?.isCover ?? (countRow?.value ?? 0) === 0,
    }).returning()
    await db.update(media).set({ placeId, updatedAt: new Date().toISOString() }).where(eq(media.id, mediaId))
    return row
  }

  static async reorderGallery(placeId: string, orderedIds: string[]) {
    const db = useDatabase()
    for (const [index, mediaId] of orderedIds.entries()) {
      await db.update(placeMedia).set({ sortOrder: index }).where(and(eq(placeMedia.placeId, placeId), eq(placeMedia.mediaId, mediaId)))
    }
  }

  static async mediaForCollectionSource(collectionId: string, urls: string[]) {
    const wanted = urls.filter(Boolean)
    if (!wanted.length) {
      return undefined
    }
    const [row] = await useDatabase().select({ media }).from(collectionMedia).innerJoin(media, eq(collectionMedia.mediaId, media.id)).where(and(
      eq(collectionMedia.collectionId, collectionId),
      inArray(media.sourceUrl, wanted),
    )).limit(1)
    return row?.media
  }

  /** Links a stored photo to a collection. The first photo becomes the cover unless told otherwise. */
  static async attachCollectionMedia(collectionId: string, mediaId: string, options?: { sortOrder?: number, isCover?: boolean }) {
    const db = useDatabase()
    const [existing] = await db.select().from(collectionMedia).where(and(eq(collectionMedia.collectionId, collectionId), eq(collectionMedia.mediaId, mediaId))).limit(1)
    if (options?.isCover) {
      await db.update(collectionMedia).set({ isCover: false }).where(eq(collectionMedia.collectionId, collectionId))
    }
    if (existing) {
      const [row] = await db.update(collectionMedia).set({
        sortOrder: options?.sortOrder ?? existing.sortOrder,
        isCover: options?.isCover ?? existing.isCover,
      }).where(eq(collectionMedia.id, existing.id)).returning()
      return row
    }
    const [countRow] = await db.select({ value: sql<number>`count(*)::int` }).from(collectionMedia).where(eq(collectionMedia.collectionId, collectionId))
    const count = countRow?.value ?? 0
    const [row] = await db.insert(collectionMedia).values({
      collectionId,
      mediaId,
      sortOrder: options?.sortOrder ?? count,
      isCover: options?.isCover ?? count === 0,
    }).returning()
    return row
  }

  static async detachCollectionMedia(collectionId: string, mediaId: string) {
    const db = useDatabase()
    const [removed] = await db.delete(collectionMedia).where(and(eq(collectionMedia.collectionId, collectionId), eq(collectionMedia.mediaId, mediaId))).returning()
    if (removed?.isCover) {
      const [next] = await db.select().from(collectionMedia).where(eq(collectionMedia.collectionId, collectionId)).orderBy(asc(collectionMedia.sortOrder)).limit(1)
      if (next) {
        await db.update(collectionMedia).set({ isCover: true }).where(eq(collectionMedia.id, next.id))
      }
    }
    return removed
  }

  static async setCover(placeId: string, mediaId: string) {
    const db = useDatabase()
    await db.update(placeMedia).set({ isCover: false }).where(eq(placeMedia.placeId, placeId))
    await db.update(placeMedia).set({ isCover: true }).where(and(eq(placeMedia.placeId, placeId), eq(placeMedia.mediaId, mediaId)))
  }

  static async saveMedia(data: {
    id?: string
    filename: string
    mime: string
    bytes: number
    width: number | null
    height: number | null
    alt: string
    credit?: string | null
    sourceUrl?: string | null
    placeId?: string | null
    sortOrder?: number
    status?: MediaStatus
    variants?: MediaVariant[]
    lqip?: string | null
    dominantColor?: string | null
    focalX?: number
    focalY?: number
    license?: MediaLicense | null
    author?: string | null
    caption?: string | null
  }) {
    const [row] = await useDatabase().insert(media).values({
      ...(data.id ? { id: data.id } : {}),
      filename: data.filename,
      mime: data.mime,
      bytes: data.bytes,
      width: data.width,
      height: data.height,
      alt: data.alt,
      credit: data.credit ?? data.author ?? null,
      sourceUrl: data.sourceUrl ?? null,
      placeId: data.placeId ?? null,
      sortOrder: data.sortOrder ?? 0,
      status: data.status ?? 'ready',
      variants: data.variants ?? [],
      lqip: data.lqip ?? null,
      dominantColor: data.dominantColor ?? null,
      focalX: data.focalX ?? 0.5,
      focalY: data.focalY ?? 0.5,
      license: data.license ?? null,
      author: data.author ?? data.credit ?? null,
      caption: data.caption ?? null,
    }).returning()
    if (!row) {
      throw new Error('Media insert failed')
    }
    return row
  }
}

function mediaPublicPath(image: { id: string, filename: string, variants: MediaVariant[] | null }) {
  const variants = image.variants ?? []
  if (variants.some((item) => item.file === 'og.jpg')) {
    return `/media/${image.id}/og.jpg`
  }
  return `/media/${image.filename}`
}

function imagesForIds(ids: string[], images: Array<typeof media.$inferSelect>) {
  const wanted = new Set(ids)
  return images.filter((image) => wanted.has(image.id))
}

function galleryImages(placeId: string, images: Array<typeof media.$inferSelect>, links: Array<typeof placeMedia.$inferSelect>) {
  const linkedIds = links.filter((link) => link.placeId === placeId).map((link) => link.mediaId)
  const fromJoin = images.filter((image) => linkedIds.includes(image.id))
  if (fromJoin.length) {
    return fromJoin
  }
  return images.filter((image) => image.placeId === placeId)
}

type OrderedStop = { placeSlug: string, note?: string | null }
type ResolvedStop = { placeId: string, note: string | null }

function blankNote(note: string | null | undefined) {
  const text = note?.trim()
  return text || null
}

async function resolveStops(stops: OrderedStop[], tx?: ContentTx) {
  const db = tx ?? useDatabase()
  const resolved: ResolvedStop[] = []
  for (const stop of stops) {
    const [place] = await db.select({ id: places.id }).from(places).where(eq(places.slug, stop.placeSlug)).limit(1)
    if (!place) {
      throw new Error(`Place not found: ${stop.placeSlug}`)
    }
    resolved.push({ placeId: place.id, note: blankNote(stop.note) })
  }
  return resolved
}

async function writeRoutePoints(routeId: string, stops: ResolvedStop[], tx?: ContentTx) {
  const write = async (db: ContentTx) => {
    await db.delete(routePoints).where(eq(routePoints.routeId, routeId))
    if (!stops.length) {
      return
    }
    // Position is the array index so the saved order matches the request.
    await db.insert(routePoints).values(stops.map((stop, position) => ({
      routeId,
      placeId: stop.placeId,
      position,
      note: stop.note,
    })))
  }
  if (tx) {
    await write(tx)
    return
  }
  await useDatabase().transaction(write)
}

async function writeCollectionItems(collectionId: string, stops: ResolvedStop[], tx?: ContentTx) {
  const write = async (db: ContentTx) => {
    await db.delete(collectionItems).where(eq(collectionItems.collectionId, collectionId))
    if (!stops.length) {
      return
    }
    await db.insert(collectionItems).values(stops.map((stop, position) => ({
      collectionId,
      placeId: stop.placeId,
      position,
      note: stop.note,
    })))
  }
  if (tx) {
    await write(tx)
    return
  }
  await useDatabase().transaction(write)
}

async function redirectByPath(fromPath: string) {
  const [row] = await useDatabase()
    .select({
      fromPath: slugRedirects.fromPath,
      toPath: slugRedirects.toPath,
      statusCode: slugRedirects.statusCode,
    })
    .from(slugRedirects)
    .where(eq(slugRedirects.fromPath, fromPath))
    .limit(1)
  return row ?? null
}

async function markGone(fromPath: string, tx?: ContentTx) {
  const db = tx ?? useDatabase()
  const [existing] = await db.select().from(slugRedirects).where(eq(slugRedirects.fromPath, fromPath)).limit(1)
  if (!existing) {
    await db.insert(slugRedirects).values({ fromPath, toPath: null, statusCode: 410 })
    return
  }
  await db.update(slugRedirects).set({ toPath: null, statusCode: 410 }).where(eq(slugRedirects.id, existing.id))
}

async function clearGone(fromPath: string, tx?: ContentTx) {
  const db = tx ?? useDatabase()
  await db.delete(slugRedirects).where(and(eq(slugRedirects.fromPath, fromPath), eq(slugRedirects.statusCode, 410)))
}

async function syncGonePath(path: string, status: PublicationStatus, tx?: ContentTx) {
  if (status === 'published') {
    await clearGone(path, tx)
    return
  }
  if (status === 'archived') {
    await markGone(path, tx)
  }
}

async function upsertRedirect(fromPath: string, toPath: string, tx?: ContentTx) {
  const db = tx ?? useDatabase()
  const [existing] = await db.select().from(slugRedirects).where(eq(slugRedirects.fromPath, fromPath)).limit(1)
  if (!existing) {
    await db.insert(slugRedirects).values({ fromPath, toPath, statusCode: 301 })
    return
  }
  await db.update(slugRedirects).set({ toPath, statusCode: 301 }).where(eq(slugRedirects.id, existing.id))
}

export type { PublicationStatus, SourceLink, VisitStatus }
