import type { AuthorKind, SourceLink, VisitStatus } from '../types/entities'
import { eq } from 'drizzle-orm'
import { useDatabase } from '../database'
import { categories, collectionItems, collections, places, quests, questSteps, regions, routePoints, routes, slugRedirects } from '../tables'
import initialContent from './initial-content.json'

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
  region: { slug: string, title: string, description: string }
  categories: Array<{ slug: string, title: string, description: string, seoTitle: string, seoDescription: string }>
  places: SeedPlace[]
  route: { slug: string, title: string, summary: string, body: string, placeSlugs: string[] }
  collection: { slug: string, title: string, summary: string, body: string, placeSlugs: string[] }
  quest: { slug: string, title: string, summary: string, body: string, placeSlugs: string[] }
  redirects: Array<{ fromPath: string, toPath: string, statusCode: number }>
}

const seed = initialContent as SeedFile

export async function applyInitialContent() {
  const region = await upsertRegion(seed.region)
  const categoryIds = new Map<string, string>()
  for (const category of seed.categories) {
    const row = await upsertCategory(category)
    categoryIds.set(category.slug, row.id)
  }
  const placeIds = new Map<string, string>()
  for (const place of seed.places) {
    const row = await upsertPlace(place, region.id, categoryIds.get(place.categorySlug) ?? null)
    placeIds.set(place.slug, row.id)
  }
  const route = await upsertRoute(seed.route, region.id)
  await replacePoints(routePoints, routePoints.routeId, route.id, seed.route.placeSlugs, placeIds)
  const collection = await upsertCollection(seed.collection)
  await replacePoints(collectionItems, collectionItems.collectionId, collection.id, seed.collection.placeSlugs, placeIds)
  const quest = await upsertQuest(seed.quest, route.id)
  await replaceQuestSteps(quest.id, seed.quest.placeSlugs, placeIds, seed.places)
  for (const redirect of seed.redirects) {
    await upsertRedirect(redirect.fromPath, redirect.toPath, redirect.statusCode)
  }
  return { places: placeIds.size }
}

async function upsertRegion(data: SeedFile['region']) {
  const db = useDatabase()
  const [existing] = await db.select().from(regions).where(eq(regions.slug, data.slug)).limit(1)
  if (!existing) {
    const [created] = await db.insert(regions).values(data).returning()
    if (!created) {
      throw new Error('Region seed failed')
    }
    return created
  }
  const [updated] = await db.update(regions).set({
    title: data.title,
    description: data.description,
    updatedAt: new Date().toISOString(),
  }).where(eq(regions.id, existing.id)).returning()
  return updated ?? existing
}

async function upsertCategory(data: SeedFile['categories'][number]) {
  const db = useDatabase()
  const [existing] = await db.select().from(categories).where(eq(categories.slug, data.slug)).limit(1)
  const values = {
    title: data.title,
    description: data.description,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    updatedAt: new Date().toISOString(),
  }
  if (!existing) {
    const [created] = await db.insert(categories).values({ slug: data.slug, ...values }).returning()
    if (!created) {
      throw new Error(`Category seed failed: ${data.slug}`)
    }
    return created
  }
  const [updated] = await db.update(categories).set(values).where(eq(categories.id, existing.id)).returning()
  return updated ?? existing
}

async function upsertPlace(place: SeedPlace, regionId: string, categoryId: string | null) {
  const db = useDatabase()
  const values = {
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
    publicationStatus: 'published' as const,
    updatedAt: new Date().toISOString(),
  }
  const [existing] = await db.select().from(places).where(eq(places.slug, place.slug)).limit(1)
  if (!existing) {
    const [created] = await db.insert(places).values({ slug: place.slug, ...values }).returning()
    if (!created) {
      throw new Error(`Place seed failed: ${place.slug}`)
    }
    return created
  }
  const [updated] = await db.update(places).set(values).where(eq(places.id, existing.id)).returning()
  return updated ?? existing
}

async function upsertRoute(data: SeedFile['route'], regionId: string) {
  const db = useDatabase()
  const values = {
    title: data.title,
    summary: data.summary,
    body: data.body,
    regionId,
    publicationStatus: 'published' as const,
    updatedAt: new Date().toISOString(),
  }
  const [existing] = await db.select().from(routes).where(eq(routes.slug, data.slug)).limit(1)
  if (!existing) {
    const [created] = await db.insert(routes).values({ slug: data.slug, ...values }).returning()
    if (!created) {
      throw new Error('Route seed failed')
    }
    return created
  }
  const [updated] = await db.update(routes).set(values).where(eq(routes.id, existing.id)).returning()
  return updated ?? existing
}

async function upsertCollection(data: SeedFile['collection']) {
  const db = useDatabase()
  const values = {
    title: data.title,
    summary: data.summary,
    body: data.body,
    publicationStatus: 'published' as const,
    updatedAt: new Date().toISOString(),
  }
  const [existing] = await db.select().from(collections).where(eq(collections.slug, data.slug)).limit(1)
  if (!existing) {
    const [created] = await db.insert(collections).values({ slug: data.slug, ...values }).returning()
    if (!created) {
      throw new Error('Collection seed failed')
    }
    return created
  }
  const [updated] = await db.update(collections).set(values).where(eq(collections.id, existing.id)).returning()
  return updated ?? existing
}

async function upsertQuest(data: SeedFile['quest'], routeId: string) {
  const db = useDatabase()
  const values = {
    title: data.title,
    summary: data.summary,
    body: data.body,
    routeId,
    publicationStatus: 'published' as const,
    updatedAt: new Date().toISOString(),
  }
  const [existing] = await db.select().from(quests).where(eq(quests.slug, data.slug)).limit(1)
  if (!existing) {
    const [created] = await db.insert(quests).values({ slug: data.slug, ...values }).returning()
    if (!created) {
      throw new Error('Quest seed failed')
    }
    return created
  }
  const [updated] = await db.update(quests).set(values).where(eq(quests.id, existing.id)).returning()
  return updated ?? existing
}

async function replacePoints(
  table: typeof routePoints | typeof collectionItems,
  parentColumn: typeof routePoints.routeId | typeof collectionItems.collectionId,
  parentId: string,
  slugs: string[],
  placeIds: Map<string, string>,
) {
  const db = useDatabase()
  await db.delete(table).where(eq(parentColumn, parentId))
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

async function replaceQuestSteps(questId: string, slugs: string[], placeIds: Map<string, string>, allPlaces: SeedPlace[]) {
  const db = useDatabase()
  await db.delete(questSteps).where(eq(questSteps.questId, questId))
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

async function upsertRedirect(fromPath: string, toPath: string, statusCode: number) {
  const db = useDatabase()
  const [existing] = await db.select().from(slugRedirects).where(eq(slugRedirects.fromPath, fromPath)).limit(1)
  if (!existing) {
    await db.insert(slugRedirects).values({ fromPath, toPath, statusCode })
    return
  }
  await db.update(slugRedirects).set({ toPath, statusCode }).where(eq(slugRedirects.id, existing.id))
}
