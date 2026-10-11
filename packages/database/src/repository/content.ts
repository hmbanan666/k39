import type { PlaceDraft } from '../types'
import type { MediaLicense, MediaStatus, MediaVariant, PublicationStatus, SourceLink, VisitStatus } from '../types/entities'
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { categories, collectionItems, collections, mcpAudits, media, offers, placeMedia, places, quests, questSteps, regions, relatedLinks, revisions, routePoints, routes, slugRedirects } from '../tables'

const published = 'published' as const

export class Content {
  static async redirects() {
    return useDatabase().select().from(slugRedirects)
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
      ? await this.nearest(place.latitude, place.longitude, place.slug, 5)
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
    const points = await db.select({ slug: places.slug, title: places.title, position: routePoints.position }).from(routePoints).innerJoin(places, eq(routePoints.placeId, places.id)).where(and(eq(routePoints.routeId, route.id), eq(places.publicationStatus, published))).orderBy(asc(routePoints.position))
    return { route, points }
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
    const items = await db.select({ slug: places.slug, title: places.title, position: collectionItems.position }).from(collectionItems).innerJoin(places, eq(collectionItems.placeId, places.id)).where(and(eq(collectionItems.collectionId, collection.id), eq(places.publicationStatus, published))).orderBy(asc(collectionItems.position))
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
    const steps = await db.select({ slug: places.slug, title: places.title, position: questSteps.position }).from(questSteps).innerJoin(places, eq(questSteps.placeId, places.id)).where(and(eq(questSteps.questId, quest.id), eq(places.publicationStatus, published))).orderBy(asc(questSteps.position))
    return { quest, steps }
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

  static async savePlace(data: PlaceDraft & { slug: string }, userId?: string | null) {
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
      const [updated] = await db.update(places).set({
        ...data,
        updatedBy: userId ?? null,
        updatedAt: new Date().toISOString(),
      }).where(eq(places.id, existing.id)).returning()
      return updated ?? existing
    }
    const [created] = await db.insert(places).values({
      ...data,
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

  static async listRegions() {
    return useDatabase().select().from(regions).orderBy(asc(regions.title))
  }

  static async saveRoute(data: { id?: string, slug: string, title: string, summary?: string | null, body?: string, publicationStatus?: PublicationStatus, seoTitle?: string | null, seoDescription?: string | null, ogImage?: string | null, noindex?: boolean }, userId?: string | null) {
    const db = useDatabase()
    const [existing] = data.id
      ? await db.select().from(routes).where(eq(routes.id, data.id)).limit(1)
      : await db.select().from(routes).where(eq(routes.slug, data.slug)).limit(1)
    if (existing && existing.slug !== data.slug) {
      await upsertRedirect(`/marshruty/${existing.slug}`, `/marshruty/${data.slug}`)
    }
    const values = {
      slug: data.slug,
      title: data.title,
      summary: data.summary ?? existing?.summary ?? null,
      body: data.body ?? existing?.body ?? '',
      publicationStatus: data.publicationStatus ?? existing?.publicationStatus ?? 'draft',
      seoTitle: data.seoTitle ?? existing?.seoTitle ?? null,
      seoDescription: data.seoDescription ?? existing?.seoDescription ?? null,
      ogImage: data.ogImage ?? existing?.ogImage ?? null,
      noindex: data.noindex ?? existing?.noindex ?? false,
      updatedBy: userId ?? null,
      updatedAt: new Date().toISOString(),
    }
    if (!existing) {
      const [created] = await db.insert(routes).values(values).returning()
      if (!created) {
        throw new Error('Route insert failed')
      }
      return created
    }
    const [updated] = await db.update(routes).set(values).where(eq(routes.id, existing.id)).returning()
    return updated ?? existing
  }

  static async saveCollection(data: { id?: string, slug: string, title: string, summary?: string | null, body?: string, publicationStatus?: PublicationStatus, seoTitle?: string | null, seoDescription?: string | null, ogImage?: string | null, noindex?: boolean }, userId?: string | null) {
    const db = useDatabase()
    const [existing] = data.id
      ? await db.select().from(collections).where(eq(collections.id, data.id)).limit(1)
      : await db.select().from(collections).where(eq(collections.slug, data.slug)).limit(1)
    if (existing && existing.slug !== data.slug) {
      await upsertRedirect(`/podborki/${existing.slug}`, `/podborki/${data.slug}`)
    }
    const values = {
      slug: data.slug,
      title: data.title,
      summary: data.summary ?? existing?.summary ?? null,
      body: data.body ?? existing?.body ?? '',
      publicationStatus: data.publicationStatus ?? existing?.publicationStatus ?? 'draft',
      seoTitle: data.seoTitle ?? existing?.seoTitle ?? null,
      seoDescription: data.seoDescription ?? existing?.seoDescription ?? null,
      ogImage: data.ogImage ?? existing?.ogImage ?? null,
      noindex: data.noindex ?? existing?.noindex ?? false,
      updatedBy: userId ?? null,
      updatedAt: new Date().toISOString(),
    }
    if (!existing) {
      const [created] = await db.insert(collections).values(values).returning()
      if (!created) {
        throw new Error('Collection insert failed')
      }
      return created
    }
    const [updated] = await db.update(collections).set(values).where(eq(collections.id, existing.id)).returning()
    return updated ?? existing
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

  static async saveCategory(id: string, data: { title: string, description: string, seoTitle?: string | null, seoDescription?: string | null, ogImage?: string | null, noindex?: boolean }) {
    const [updated] = await useDatabase().update(categories).set({
      ...data,
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

  static async listAllMedia() {
    return useDatabase().select().from(media).orderBy(asc(media.createdAt))
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

function galleryImages(placeId: string, images: Array<typeof media.$inferSelect>, links: Array<typeof placeMedia.$inferSelect>) {
  const linkedIds = links.filter((link) => link.placeId === placeId).map((link) => link.mediaId)
  const fromJoin = images.filter((image) => linkedIds.includes(image.id))
  if (fromJoin.length) {
    return fromJoin
  }
  return images.filter((image) => image.placeId === placeId)
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

export type { PublicationStatus, SourceLink, VisitStatus }
