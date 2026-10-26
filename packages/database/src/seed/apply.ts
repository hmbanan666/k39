import type { AuthorKind, SourceLink, VisitStatus } from '../types/entities'
import { and, eq } from 'drizzle-orm'
import { useDatabase } from '../database'
import { firstPublishedStamp } from '../first-published'
import {
  categories,
  collectionItems,
  collections,
  contentImports,
  places,
  quests,
  questSteps,
  regions,
  revisions,
  routePoints,
  routes,
  slugRedirects,
} from '../tables'
import initialContent from './initial-content.json'

export const INITIAL_CONTENT_IMPORT_ID = 'initial-content-v1'
export const DRAFT_BACKFILL_IMPORT_ID = 'initial-content-v2'

const LEGACY_DRAFTS = [
  { entityType: 'route', slug: 'five-forts', fromPath: '/marshruty/five-forts', toPath: '/marshruty/pyat-fortov' },
  { entityType: 'quest', slug: 'five-forts', fromPath: '/kvesty/five-forts', toPath: '/kvesty/pyat-fortov' },
] as const

interface SeedPlace {
  slug: string
  title: string
  categorySlug: string
  regionSlug: string
  latitude: number
  longitude: number
  visitStatus: VisitStatus
  hours: string | null
  price: string | null
  howToGet: string | null
  summary: string
  body: string
  sources: SourceLink[]
  authorKind: AuthorKind
}

interface SeedFile {
  region: { slug: string; title: string; description: string }
  categories: Array<{
    slug: string
    title: string
    description: string
    body?: string
    seoTitle: string
    seoDescription: string
  }>
  places: SeedPlace[]
  route: { slug: string; title: string; summary: string; body: string; placeSlugs: string[] }
  collection: { slug: string; title: string; summary: string; body: string; placeSlugs: string[] }
  quest: { slug: string; title: string; summary: string; body: string; placeSlugs: string[] }
  redirects: Array<{ fromPath: string; toPath: string; statusCode: number }>
}

const seed = initialContent as SeedFile

export async function applyInitialContent() {
  const imported = await importFreshContent()
  const backfill = await backfillUntouchedDrafts()
  return {
    places: imported.places,
    skipped: imported.skipped && backfill.skipped,
    filled: backfill.filled,
  }
}

async function importFreshContent() {
  if (await importAlreadyApplied(INITIAL_CONTENT_IMPORT_ID)) {
    return { places: 0, skipped: true }
  }
  const region = await insertRegion(seed.region)
  const categoryIds = new Map<string, string>()
  for (const category of seed.categories) {
    const row = await insertCategory(category)
    categoryIds.set(category.slug, row.id)
  }
  const placeIds = new Map<string, string>()
  for (const place of seed.places) {
    const row = await insertPlace(place, region.id, categoryIds.get(place.categorySlug) ?? null)
    placeIds.set(place.slug, row.id)
  }
  const route = await insertRoute(seed.route, region.id)
  await insertPoints(routePoints, routePoints.routeId, route.id, seed.route.placeSlugs, placeIds)
  const collection = await insertCollection(seed.collection)
  await insertPoints(collectionItems, collectionItems.collectionId, collection.id, seed.collection.placeSlugs, placeIds)
  const quest = await insertQuest(seed.quest, route.id)
  await insertQuestSteps(quest.id, seed.quest.placeSlugs, placeIds, seed.places)
  for (const redirect of seed.redirects) {
    await insertRedirect(redirect.fromPath, redirect.toPath, redirect.statusCode)
  }
  await recordImport(INITIAL_CONTENT_IMPORT_ID)
  return { places: placeIds.size, skipped: false }
}

async function backfillUntouchedDrafts() {
  if (await importAlreadyApplied(DRAFT_BACKFILL_IMPORT_ID)) {
    return { skipped: true, filled: 0 }
  }
  const region = await insertRegion(seed.region)
  const categoryIds = new Map<string, string>()
  for (const category of seed.categories) {
    const row = await insertCategory(category)
    categoryIds.set(category.slug, row.id)
  }
  let filled = 0
  for (const place of seed.places) {
    const wrote = await fillUntouchedDraft(place, region.id, categoryIds.get(place.categorySlug) ?? null)
    if (wrote) {
      filled += 1
    }
  }
  await parkLegacyDrafts()
  await recordImport(DRAFT_BACKFILL_IMPORT_ID)
  return { skipped: false, filled }
}

async function fillUntouchedDraft(place: SeedPlace, regionId: string, categoryId: string | null) {
  const db = useDatabase()
  const [existing] = await db.select().from(places).where(eq(places.slug, place.slug)).limit(1)
  if (!existing) {
    await insertPlace(place, regionId, categoryId)
    return true
  }
  if (!(await isUntouchedEmptyDraft(existing))) {
    return false
  }
  await db
    .update(places)
    .set({
      title: place.title,
      categoryId,
      regionId,
      latitude: place.latitude,
      longitude: place.longitude,
      status: place.visitStatus,
      hours: place.hours,
      price: place.price,
      howToGet: place.howToGet,
      summary: place.summary,
      body: place.body,
      sources: place.sources,
      authorKind: place.authorKind,
      publicationStatus: 'published',
      firstPublishedAt: firstPublishedStamp(existing.firstPublishedAt, 'published'),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(places.id, existing.id))
  return true
}

async function isUntouchedEmptyDraft(row: {
  id: string
  body: string | null
  publicationStatus: string
  updatedBy: string | null
}) {
  if (row.publicationStatus !== 'draft' || row.updatedBy) {
    return false
  }
  if ((row.body ?? '').trim() !== '') {
    return false
  }
  const [revision] = await useDatabase()
    .select({ id: revisions.id })
    .from(revisions)
    .where(and(eq(revisions.entityType, 'place'), eq(revisions.entityId, row.id)))
    .limit(1)
  return !revision
}

async function parkLegacyDrafts() {
  for (const legacy of LEGACY_DRAFTS) {
    const row =
      legacy.entityType === 'route' ? await legacyRow(routes, legacy.slug) : await legacyRow(quests, legacy.slug)
    if (!row || row.publicationStatus !== 'draft' || row.updatedBy || (row.body ?? '').trim() !== '') {
      continue
    }
    const [revision] = await useDatabase()
      .select({ id: revisions.id })
      .from(revisions)
      .where(and(eq(revisions.entityType, legacy.entityType), eq(revisions.entityId, row.id)))
      .limit(1)
    if (revision) {
      continue
    }
    await insertRedirect(legacy.fromPath, legacy.toPath, 301)
  }
}

async function legacyRow(table: typeof routes | typeof quests, slug: string) {
  const [row] = await useDatabase()
    .select({
      id: table.id,
      body: table.body,
      publicationStatus: table.publicationStatus,
      updatedBy: table.updatedBy,
    })
    .from(table)
    .where(eq(table.slug, slug))
    .limit(1)
  return row
}

async function importAlreadyApplied(id: string) {
  const [row] = await useDatabase()
    .select({ id: contentImports.id })
    .from(contentImports)
    .where(eq(contentImports.id, id))
    .limit(1)
  return Boolean(row)
}

async function recordImport(id: string) {
  await useDatabase().insert(contentImports).values({ id }).onConflictDoNothing()
}

async function insertRegion(data: SeedFile['region']) {
  const db = useDatabase()
  const [existing] = await db.select().from(regions).where(eq(regions.slug, data.slug)).limit(1)
  if (existing) {
    return existing
  }
  const [created] = await db.insert(regions).values(data).returning()
  if (!created) {
    throw new Error('Region seed failed')
  }
  return created
}

async function insertCategory(data: SeedFile['categories'][number]) {
  const db = useDatabase()
  const [existing] = await db.select().from(categories).where(eq(categories.slug, data.slug)).limit(1)
  if (existing) {
    return existing
  }
  const [created] = await db
    .insert(categories)
    .values({
      slug: data.slug,
      title: data.title,
      description: data.description,
      body: data.body ?? '',
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      firstPublishedAt: firstPublishedStamp(null, 'published'),
    })
    .returning()
  if (!created) {
    throw new Error(`Category seed failed: ${data.slug}`)
  }
  return created
}

async function insertPlace(place: SeedPlace, regionId: string, categoryId: string | null) {
  const db = useDatabase()
  const [existing] = await db.select().from(places).where(eq(places.slug, place.slug)).limit(1)
  if (existing) {
    return existing
  }
  const [created] = await db
    .insert(places)
    .values({
      slug: place.slug,
      title: place.title,
      categoryId,
      regionId,
      latitude: place.latitude,
      longitude: place.longitude,
      status: place.visitStatus,
      hours: place.hours,
      price: place.price,
      howToGet: place.howToGet,
      summary: place.summary,
      body: place.body,
      sources: place.sources,
      authorKind: place.authorKind,
      publicationStatus: 'published',
      firstPublishedAt: firstPublishedStamp(null, 'published'),
    })
    .returning()
  if (!created) {
    throw new Error(`Place seed failed: ${place.slug}`)
  }
  return created
}

async function insertRoute(data: SeedFile['route'], regionId: string) {
  const db = useDatabase()
  const [existing] = await db.select().from(routes).where(eq(routes.slug, data.slug)).limit(1)
  if (existing) {
    return existing
  }
  const [created] = await db
    .insert(routes)
    .values({
      slug: data.slug,
      title: data.title,
      summary: data.summary,
      body: data.body,
      regionId,
      publicationStatus: 'published',
      firstPublishedAt: firstPublishedStamp(null, 'published'),
    })
    .returning()
  if (!created) {
    throw new Error('Route seed failed')
  }
  return created
}

async function insertCollection(data: SeedFile['collection']) {
  const db = useDatabase()
  const [existing] = await db.select().from(collections).where(eq(collections.slug, data.slug)).limit(1)
  if (existing) {
    return existing
  }
  const [created] = await db
    .insert(collections)
    .values({
      slug: data.slug,
      title: data.title,
      summary: data.summary,
      body: data.body,
      publicationStatus: 'published',
      firstPublishedAt: firstPublishedStamp(null, 'published'),
    })
    .returning()
  if (!created) {
    throw new Error('Collection seed failed')
  }
  return created
}

async function insertQuest(data: SeedFile['quest'], routeId: string) {
  const db = useDatabase()
  const [existing] = await db.select().from(quests).where(eq(quests.slug, data.slug)).limit(1)
  if (existing) {
    return existing
  }
  const [created] = await db
    .insert(quests)
    .values({
      slug: data.slug,
      title: data.title,
      summary: data.summary,
      body: data.body,
      routeId,
      publicationStatus: 'published',
      firstPublishedAt: firstPublishedStamp(null, 'published'),
    })
    .returning()
  if (!created) {
    throw new Error('Quest seed failed')
  }
  return created
}

async function insertPoints(
  table: typeof routePoints | typeof collectionItems,
  parentColumn: typeof routePoints.routeId | typeof collectionItems.collectionId,
  parentId: string,
  slugs: string[],
  placeIds: Map<string, string>,
) {
  const db = useDatabase()
  const [existing] = await db.select({ id: table.id }).from(table).where(eq(parentColumn, parentId)).limit(1)
  if (existing) {
    return
  }
  const rows = slugs.map((slug, position) => {
    const placeId = placeIds.get(slug)
    if (!placeId) {
      throw new Error(`Seed point missing place ${slug}`)
    }
    return table === routePoints
      ? { routeId: parentId, placeId, position }
      : { collectionId: parentId, placeId, position }
  })
  if (rows.length) {
    await db.insert(table).values(rows as never)
  }
}

async function insertQuestSteps(
  questId: string,
  slugs: string[],
  placeIds: Map<string, string>,
  allPlaces: SeedPlace[],
) {
  const db = useDatabase()
  const [existing] = await db
    .select({ id: questSteps.id })
    .from(questSteps)
    .where(eq(questSteps.questId, questId))
    .limit(1)
  if (existing) {
    return
  }
  const rows = slugs.map((slug, position) => {
    const placeId = placeIds.get(slug)
    const place = allPlaces.find((item) => item.slug === slug)
    if (!placeId || !place) {
      throw new Error(`Seed quest step missing ${slug}`)
    }
    return { questId, placeId, position, title: place.title, prompt: 'Отметьте визит, когда будете на месте.' }
  })
  if (rows.length) {
    await db.insert(questSteps).values(rows)
  }
}

async function insertRedirect(fromPath: string, toPath: string, statusCode: number) {
  const db = useDatabase()
  const [existing] = await db
    .select({ id: slugRedirects.id })
    .from(slugRedirects)
    .where(eq(slugRedirects.fromPath, fromPath))
    .limit(1)
  if (existing) {
    return
  }
  await db.insert(slugRedirects).values({ fromPath, toPath, statusCode })
}
