// Lives in the database suite so it uses that Postgres.
// Typechecked from apps/web-app/tsconfig.writer-test.json, where Nuxt
// auto-imports exist. This package's tsc excludes the file.
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { enterContentScope, requireEditorContent } from '../../../../../apps/web-app/server/utils/access'
import { applyAdminContentDraft, collectionDraftNotice, discardAdminContentDraft, routeDraftNotice, withPendingGuard } from '../../../../../apps/web-app/server/utils/admin/content-draft'
import { readCollection, saveCollectionDraft } from '../../../../../apps/web-app/server/utils/mcp/collections'
import { refuseLiveFact, updateFact } from '../../../../../apps/web-app/server/utils/mcp/fact-write'
import { importCommonsPhoto, uploadMediaFromUrl } from '../../../../../apps/web-app/server/utils/mcp/media-import'
import { attachCollectionPhoto, attachPlacePhoto, detachCollectionPhoto, refuseIncomingPhoto, refuseVenuePhoto } from '../../../../../apps/web-app/server/utils/mcp/photos'
import { setPublication } from '../../../../../apps/web-app/server/utils/mcp/publish'
import { writeQuest } from '../../../../../apps/web-app/server/utils/mcp/quests'
import { readRoute, updateRouteDraft } from '../../../../../apps/web-app/server/utils/mcp/routes'
import { assertScheduleWritable } from '../../../../../apps/web-app/server/utils/mcp/schedule-target'
import { deleteVenue, updateVenue } from '../../../../../apps/web-app/server/utils/venues/write'
import { valueHash } from '../../../../../apps/web-app/shared/facts'
import { renderMarkdown } from '../../../../../apps/web-app/shared/markdown'
import { toPublicModules } from '../../../../../apps/web-app/shared/page-modules'
import { bodyOf } from '../../body-sections'
import { useDatabase } from '../../database'
import { SOURCE_LINK_LIMIT, sourceLimitMessage } from '../../sources'
import { collections, contentDrafts, facts, mcpAudits, media, pageReviews, places, quests, regions, revisions, routePoints, routes, schedules, slugRedirects, venues, verificationQueue } from '../../tables'
import { Content, Editor } from '../content'
import { Facts } from '../facts'

function draftFields(result: object) {
  if (!('renderedFields' in result) || !Array.isArray(result.renderedFields)) {
    throw new Error('stored draft omitted renderedFields')
  }
  return result.renderedFields as string[]
}

/** The HTML the public collection page renders from the live row. */
function renderedCollection(loaded: NonNullable<Awaited<ReturnType<typeof Content.publishedCollection>>>) {
  const modules = loaded.collection.modules ?? []
  if (modules.length) {
    return JSON.stringify(toPublicModules(modules, (markdown) => renderMarkdown(markdown)))
  }
  return renderMarkdown(loaded.collection.body)
}

const placeIds: string[] = []
const routeIds: string[] = []
const collectionIds: string[] = []
const questIds: string[] = []
const venueIds: string[] = []
const mediaIds: string[] = []
const redirectPaths: string[] = []
const regionIds: string[] = []
const factSubjectIds: string[] = []

afterEach(async () => {
  enterContentScope('editor')
  const database = useDatabase()
  for (const id of [...placeIds, ...routeIds, ...collectionIds, ...questIds, ...venueIds, ...factSubjectIds, ...regionIds]) {
    await database.delete(verificationQueue).where(eq(verificationQueue.entityId, id))
    await database.delete(pageReviews).where(eq(pageReviews.entityId, id))
    await database.delete(contentDrafts).where(eq(contentDrafts.entityId, id))
    await database.delete(revisions).where(eq(revisions.entityId, id))
    await database.delete(mcpAudits).where(eq(mcpAudits.entityId, id))
    await database.delete(schedules).where(eq(schedules.entityId, id))
    await database.delete(facts).where(eq(facts.subjectId, id))
  }
  for (const id of mediaIds) {
    await database.delete(media).where(eq(media.id, id))
  }
  for (const path of redirectPaths) {
    await database.delete(slugRedirects).where(eq(slugRedirects.fromPath, path))
  }
  for (const id of questIds) {
    await database.delete(quests).where(eq(quests.id, id))
  }
  for (const id of routeIds) {
    await database.delete(routes).where(eq(routes.id, id))
  }
  for (const id of collectionIds) {
    await database.delete(collections).where(eq(collections.id, id))
  }
  for (const id of placeIds) {
    await database.delete(places).where(eq(places.id, id))
  }
  for (const id of venueIds) {
    await database.delete(venues).where(eq(venues.id, id))
  }
  for (const id of regionIds) {
    await database.delete(regions).where(eq(regions.id, id))
  }
  placeIds.length = 0
  routeIds.length = 0
  collectionIds.length = 0
  questIds.length = 0
  venueIds.length = 0
  mediaIds.length = 0
  redirectPaths.length = 0
  regionIds.length = 0
  factSubjectIds.length = 0
})

async function place(slug: string, title: string) {
  const row = await Editor.savePlace({
    slug,
    title,
    summary: 'Остановка.',
    body: 'Текст остановки.',
    publicationStatus: 'published',
  })
  placeIds.push(row.id)
  return row
}

async function publishedCollection(slug: string) {
  const row = await Editor.saveCollection({
    slug,
    title: 'Старая подборка',
    summary: 'Старое описание подборки.',
    body: 'Старый текст подборки про площадь.',
    publicationStatus: 'published',
    items: [{ placeSlug: 'pending-stop-a', note: 'сначала' }],
  })
  collectionIds.push(row.id)
  return row
}

async function publishedRoute(slug: string) {
  const row = await Editor.saveRoute({
    slug,
    title: 'Старый маршрут',
    summary: 'Старое описание маршрута.',
    body: 'Старый текст маршрута про вал.',
    publicationStatus: 'published',
    points: [{ placeSlug: 'pending-stop-a', note: 'старт' }],
    path: [[20.5, 54.7]],
  })
  routeIds.push(row.id)
  return row
}

const liveUnchanged = {
  statusCode: 409,
  statusMessage: expect.stringContaining('The live page was not changed'),
}

async function storedPhoto(name: string, caption?: string) {
  const row = await Editor.saveMedia({
    filename: `${name}.webp`,
    mime: 'image/webp',
    bytes: 1,
    width: 10,
    height: 10,
    alt: name,
    caption: caption ?? null,
    author: 'Автор',
    license: 'own',
  })
  mediaIds.push(row.id)
  return row
}

async function phoneFact(subjectType: 'place' | 'venue' | 'route' | 'route_stop' | 'region', subjectId: string, text: string) {
  const value = { text }
  const saved = await Facts.upsert({
    kind: 'phone',
    subjectType,
    subjectId,
    slot: 'phone',
    value,
    valueHash: valueHash(value),
    sourceUrl: null,
    sourceTitle: null,
    sourceKind: 'official',
    checkedAt: '2026-01-01T00:00:00.000Z',
    ttlDays: 180,
    confidence: 'stated',
    actor: 'editor',
  }, [])
  return saved.fact
}

describe('pending collection and route drafts', () => {
  it('stores a draft-token collection write, leaves the public page, and merges a second write', async () => {
    await place('pending-stop-a', 'Первая остановка')
    await place('pending-stop-b', 'Вторая остановка')
    const live = await publishedCollection('pending-collection')
    enterContentScope('draft')
    const first = await saveCollectionDraft({
      id: live.id,
      slug: live.slug,
      title: 'Новая подборка',
      summary: 'Новое описание подборки.',
      body: 'Новый текст подборки про ров.',
    })
    expect(first.pendingReview).toBe(true)
    expect(first.publicationStatus).toBe('published')
    if (!('bodyLength' in first) || !('renderedFields' in first)) {
      throw new Error('expected stored draft fields')
    }
    expect(first.bodyLength).toBe('Новый текст подборки про ров.'.length)
    expect(first.renderedFields).toContain('body')
    const stored = await Editor.contentDraft('collection', live.id)
    expect(stored?.payload).toMatchObject({ title: 'Новая подборка', body: 'Новый текст подборки про ров.' })

    const second = await saveCollectionDraft({
      id: live.id,
      slug: live.slug,
      title: 'Новая подборка',
      body: 'Второй текст подборки про ров.',
      items: [{ placeSlug: 'pending-stop-b' }, { placeSlug: 'pending-stop-a', note: 'потом' }],
    })
    expect(second.pendingReview).toBe(true)
    expect(second.items.map((item) => item.placeSlug)).toEqual(['pending-stop-b', 'pending-stop-a'])
    const merged = await Editor.contentDraft('collection', live.id)
    expect(merged?.id).toBe(stored?.id)
    expect(merged?.payload).toMatchObject({
      title: 'Новая подборка',
      summary: 'Новое описание подборки.',
      body: 'Второй текст подборки про ров.',
    })
    const still = (await Editor.listCollections()).find((item) => item.id === live.id)
    expect(still?.title).toBe('Старая подборка')
    expect(still?.body).toBe('Старый текст подборки про площадь.')
    expect((await Editor.collectionItems(live.id)).map((item) => item.placeSlug)).toEqual(['pending-stop-a'])

    const page = await Content.publishedCollection(live.slug)
    expect(page?.collection.title).toBe('Старая подборка')
    expect(renderedCollection(page!)).toContain('Старый текст подборки про площадь.')
    expect(renderedCollection(page!)).not.toContain('Второй текст подборки про ров.')
    expect(page?.items.map((item) => item.slug)).toEqual(['pending-stop-a'])
  })

  it('applies a collection draft on editor publish and clears pendingReview', async () => {
    await place('pending-stop-a', 'Первая остановка')
    const live = await publishedCollection('pending-collection-apply')
    redirectPaths.push('/podborki/pending-collection-apply')
    enterContentScope('draft')
    await saveCollectionDraft({
      id: live.id,
      slug: 'pending-collection-next',
      title: 'Новая подборка',
      body: 'Новый текст подборки про ров.',
      items: [{ placeSlug: 'pending-stop-a', note: 'одна' }],
    })
    const before = await readCollection({ id: live.id })
    expect(before.pendingReview?.payload).toMatchObject({ title: 'Новая подборка' })

    enterContentScope('editor')
    const published = await setPublication({
      entity: 'collection',
      id: live.id,
      publicationStatus: 'published',
    })
    expect(published.pendingReview).toBe(false)
    const row = (await Editor.listCollections()).find((item) => item.id === live.id)
    expect(row?.slug).toBe('pending-collection-next')
    expect(row?.title).toBe('Новая подборка')
    expect(row?.body).toBe('Новый текст подборки про ров.')
    expect(await Editor.contentDraft('collection', live.id)).toBeNull()
    expect((await readCollection({ id: live.id })).pendingReview).toBeNull()
    const redirects = await useDatabase().select().from(slugRedirects).where(eq(slugRedirects.fromPath, '/podborki/pending-collection-apply'))
    expect(redirects[0]?.toPath).toBe('/podborki/pending-collection-next')
    const page = await Content.publishedCollection('pending-collection-next')
    expect(renderedCollection(page!)).toContain('Новый текст подборки про ров.')
  })

  it('stores a module projection and applies that body', async () => {
    await place('pending-stop-a', 'Первая остановка')
    const live = await Editor.saveCollection({
      slug: 'pending-modules',
      title: 'Модульная подборка',
      summary: 'Описание.',
      body: 'Старый лид модульной страницы.',
      publicationStatus: 'published',
      modules: [{ type: 'text', variant: 'lead', text: 'Старый лид модульной страницы.' }],
    })
    collectionIds.push(live.id)
    enterContentScope('draft')
    const written = await saveCollectionDraft({
      id: live.id,
      slug: live.slug,
      title: live.title,
      modules: [{ type: 'text', variant: 'lead', text: 'Новый лид модульной страницы.' }],
    })
    expect(written.pendingReview).toBe(true)
    expect(written.body).toContain('Новый лид модульной страницы.')
    expect((await Editor.listCollections()).find((item) => item.id === live.id)?.body).toContain('Старый лид')
    const page = await Content.publishedCollection(live.slug)
    expect(renderedCollection(page!)).toContain('Старый лид модульной страницы.')
    expect(renderedCollection(page!)).not.toContain('Новый лид модульной страницы.')

    enterContentScope('editor')
    await setPublication({ entity: 'collection', id: live.id, publicationStatus: 'published' })
    const row = (await Editor.listCollections()).find((item) => item.id === live.id)
    expect(row?.body).toContain('Новый лид модульной страницы.')
    expect(row?.modules).toMatchObject([{ text: 'Новый лид модульной страницы.' }])
  })

  it('stores a draft-token route write and applies points, path, and the public page', async () => {
    await place('pending-stop-a', 'Первая остановка')
    await place('pending-stop-b', 'Вторая остановка')
    const live = await publishedRoute('pending-route')
    enterContentScope('draft')
    const first = await updateRouteDraft({
      id: live.id,
      title: 'Новый маршрут',
      body: 'Новый текст маршрута про ров.',
    }, 'route_update')
    expect(first.pendingReview).toBe(true)
    expect(first.publicationStatus).toBe('published')
    expect(first.bodyLength).toBe('Новый текст маршрута про ров.'.length)
    expect(draftFields(first)).toContain('points')
    const stored = await Editor.contentDraft('route', live.id)

    const second = await updateRouteDraft({
      id: live.id,
      points: [{ placeSlug: 'pending-stop-b' }, { placeSlug: 'pending-stop-a' }],
      path: [[20.6, 54.8], [20.7, 54.9]],
    }, 'route_update')
    expect(second.points.map((item) => item.placeSlug)).toEqual(['pending-stop-b', 'pending-stop-a'])
    const merged = await Editor.contentDraft('route', live.id)
    expect(merged?.id).toBe(stored?.id)
    expect(merged?.payload).toMatchObject({
      title: 'Новый маршрут',
      body: 'Новый текст маршрута про ров.',
      path: [[20.6, 54.8], [20.7, 54.9]],
    })
    expect((await Editor.listRoutes()).find((item) => item.id === live.id)?.body).toBe('Старый текст маршрута про вал.')
    expect((await Editor.routePoints(live.id)).map((item) => item.placeSlug)).toEqual(['pending-stop-a'])
    const page = await Content.publishedRoute(live.slug)
    expect(page?.route.title).toBe('Старый маршрут')
    expect(renderMarkdown(bodyOf(page!.route))).toContain('Старый текст маршрута про вал.')
    expect(renderMarkdown(bodyOf(page!.route))).not.toContain('Новый текст маршрута про ров.')
    expect(page?.points.map((stop) => stop.slug)).toEqual(['pending-stop-a'])

    enterContentScope('editor')
    const published = await setPublication({ entity: 'route', id: live.id, publicationStatus: 'published' })
    expect(published.pendingReview).toBe(false)
    const row = (await Editor.listRoutes()).find((item) => item.id === live.id)
    expect(row?.title).toBe('Новый маршрут')
    expect(row?.body).toBe('Новый текст маршрута про ров.')
    expect(row?.path).toEqual([[20.6, 54.8], [20.7, 54.9]])
    expect((await Editor.routePoints(live.id)).map((item) => item.placeSlug)).toEqual(['pending-stop-b', 'pending-stop-a'])
    expect(await Editor.contentDraft('route', live.id)).toBeNull()
    expect((await readRoute({ id: live.id })).pendingReview).toBeNull()
    const after = await Content.publishedRoute(live.slug)
    expect(renderMarkdown(bodyOf(after!.route))).toContain('Новый текст маршрута про ров.')
    expect(after?.points.map((stop) => stop.slug)).toEqual(['pending-stop-b', 'pending-stop-a'])
  })

  it('rejects a published apply that hits the stop-list and keeps the draft', async () => {
    await place('pending-stop-a', 'Первая остановка')
    const live = await publishedRoute('pending-route-stop')
    enterContentScope('draft')
    const written = await updateRouteDraft({
      id: live.id,
      body: 'Это уютная атмосфера у вала.',
    })
    expect(written.writingWarnings?.length).toBeGreaterThan(0)
    enterContentScope('editor')
    await expect(setPublication({
      entity: 'route',
      id: live.id,
      publicationStatus: 'published',
    })).rejects.toMatchObject({ statusCode: 400 })
    expect((await Editor.listRoutes()).find((item) => item.id === live.id)?.body).toBe('Старый текст маршрута про вал.')
    expect(await Editor.contentDraft('route', live.id)).not.toBeNull()
  })

  it('stamps firstPublishedAt when a pending route or collection is applied', async () => {
    await place('pending-stop-a', 'Первая остановка')
    const route = await publishedRoute('pending-stamp-route')
    const collection = await publishedCollection('pending-stamp-collection')
    const kept = '2024-06-01T00:00:00.000Z'
    await useDatabase().update(routes).set({ firstPublishedAt: null }).where(eq(routes.id, route.id))
    await useDatabase().update(collections).set({ firstPublishedAt: kept }).where(eq(collections.id, collection.id))
    const collectionBefore = (await Editor.collectionById(collection.id))?.firstPublishedAt
    expect(collectionBefore).toBeTruthy()
    expect((await Editor.routeById(route.id))?.firstPublishedAt).toBeNull()

    enterContentScope('draft')
    await updateRouteDraft({
      id: route.id,
      title: 'Маршрут со штампом',
      body: 'Новый текст маршрута со штампом.',
    }, 'route_update')
    await saveCollectionDraft({
      id: collection.id,
      slug: collection.slug,
      title: 'Подборка со штампом',
      body: 'Новый текст подборки со штампом.',
    })

    enterContentScope('editor')
    await setPublication({ entity: 'route', id: route.id, publicationStatus: 'published' })
    await setPublication({ entity: 'collection', id: collection.id, publicationStatus: 'published' })

    const routeAfter = (await Editor.routeById(route.id))?.firstPublishedAt
    expect(routeAfter).toBeTruthy()
    expect(new Date(routeAfter ?? '').getTime()).toBeGreaterThan(new Date('2024-01-01').getTime())
    expect((await Editor.collectionById(collection.id))?.firstPublishedAt).toBe(collectionBefore)
    expect((await Editor.routeById(route.id))?.title).toBe('Маршрут со штампом')
    expect((await Editor.collectionById(collection.id))?.title).toBe('Подборка со штампом')
  })

  it('caps and dedupes sources when a pending collection or route is applied', async () => {
    await place('pending-stop-a', 'Первая остановка')
    const collection = await publishedCollection('pending-source-collection')
    const route = await publishedRoute('pending-source-route')
    const kept = [{ title: 'Старый', url: 'https://example.com/old' }]
    await useDatabase().update(collections).set({ sources: kept }).where(eq(collections.id, collection.id))

    enterContentScope('draft')
    await saveCollectionDraft({
      id: collection.id,
      slug: collection.slug,
      title: 'Подборка с источниками',
      sources: [
        { title: 'Первый', url: 'https://www.example.com/guide' },
        { title: 'Повтор', url: 'http://example.com/guide/' },
        { title: 'Второй', url: 'https://example.com/other' },
      ],
    })
    await Editor.saveContentDraft({
      entityType: 'route',
      entityId: route.id,
      publicationStatus: 'review',
      payload: {
        title: 'Маршрут с лишними источниками',
        sources: Array.from({ length: SOURCE_LINK_LIMIT + 1 }, (_, index) => ({
          title: `Источник ${index + 1}`,
          url: `https://example.com/route/${index + 1}`,
        })),
      },
    })

    enterContentScope('editor')
    await setPublication({ entity: 'collection', id: collection.id, publicationStatus: 'published' })
    await expect(setPublication({ entity: 'route', id: route.id, publicationStatus: 'published' })).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: sourceLimitMessage(),
    })

    expect((await Editor.collectionById(collection.id))?.sources).toEqual([
      { title: 'Первый', url: 'https://www.example.com/guide' },
      { title: 'Второй', url: 'https://example.com/other' },
    ])
    expect((await Editor.routeById(route.id))?.title).toBe('Старый маршрут')
    expect(await Editor.contentDraft('route', route.id)).not.toBeNull()

    enterContentScope('draft')
    await saveCollectionDraft({
      id: collection.id,
      slug: 'pending-source-collection',
      title: 'Слишком много источников',
      sources: Array.from({ length: SOURCE_LINK_LIMIT + 1 }, (_, index) => ({
        title: `Источник ${index + 1}`,
        url: `https://example.com/collection/${index + 1}`,
      })),
    })
    await Editor.saveContentDraft({
      entityType: 'route',
      entityId: route.id,
      publicationStatus: 'review',
      payload: {
        title: 'Маршрут после проверки',
        sources: [
          { title: 'Первый', url: 'https://www.example.com/route' },
          { title: 'Повтор', url: 'http://example.com/route/' },
        ],
      },
    })
    enterContentScope('editor')
    await expect(setPublication({ entity: 'collection', id: collection.id, publicationStatus: 'published' })).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: sourceLimitMessage(),
    })
    await setPublication({ entity: 'route', id: route.id, publicationStatus: 'published' })

    expect((await Editor.collectionById(collection.id))?.title).toBe('Подборка с источниками')
    expect((await Editor.collectionById(collection.id))?.sources).toHaveLength(2)
    expect(await Editor.contentDraft('collection', collection.id)).not.toBeNull()
    expect((await Editor.routeById(route.id))?.title).toBe('Маршрут после проверки')
    expect(await Editor.contentDraft('route', route.id)).toBeNull()
  })

  it('shows the admin diff, refuses a save, then apply and discard', async () => {
    await place('pending-stop-a', 'Первая остановка')
    const collection = await publishedCollection('pending-admin-collection')
    const route = await publishedRoute('pending-admin-route')
    enterContentScope('draft')
    await saveCollectionDraft({
      id: collection.id,
      slug: collection.slug,
      title: 'Новая подборка',
      body: 'Новый текст подборки про ров.',
    })
    await updateRouteDraft({
      id: route.id,
      title: 'Новый маршрут',
      body: 'Новый текст маршрута про ров.',
    })
    enterContentScope('editor')
    const collectionView = await collectionDraftNotice(collection.id)
    const routeView = await routeDraftNotice(route.id)
    expect(collectionView?.changes.map((item) => item.field)).toEqual(['title', 'body'])
    expect(collectionView?.changes[0]).toMatchObject({ live: 'Старая подборка', draft: 'Новая подборка' })
    expect(routeView?.changes.map((item) => item.field)).toEqual(['title', 'body'])

    await expect(withPendingGuard('collection', collection.id, undefined, async () => {
      throw new Error('save should not run')
    })).rejects.toMatchObject({ statusCode: 409 })
    expect((await Editor.listCollections()).find((item) => item.id === collection.id)?.title).toBe('Старая подборка')

    await withPendingGuard('route', route.id, 'discard', async (tx) => {
      return Editor.saveRoute({
        id: route.id,
        slug: route.slug,
        title: 'Правка редактора',
        body: 'Текст формы редактора на живой странице.',
        publicationStatus: 'published',
      }, null, tx)
    })
    expect((await Editor.listRoutes()).find((item) => item.id === route.id)?.title).toBe('Правка редактора')
    expect(await Editor.contentDraft('route', route.id)).toBeNull()

    const applied = await applyAdminContentDraft('collection', collection.id)
    expect(applied.pendingReview).toBe(false)
    expect((await Editor.listCollections()).find((item) => item.id === collection.id)?.title).toBe('Новая подборка')
    expect(await collectionDraftNotice(collection.id)).toBeNull()

    enterContentScope('draft')
    await updateRouteDraft({ id: route.id, body: 'Ещё один черновик маршрута про ров.' })
    enterContentScope('editor')
    await discardAdminContentDraft('route', route.id)
    expect((await Editor.listRoutes()).find((item) => item.id === route.id)?.body).toBe('Текст формы редактора на живой странице.')
    expect(await routeDraftNotice(route.id)).toBeNull()
  })

  it('still refuses publish, archive, and edits of venues, quests, and listings', async () => {
    await place('pending-stop-a', 'Первая остановка')
    const collection = await publishedCollection('pending-refuse-collection')
    const route = await publishedRoute('pending-refuse-route')
    const quest = await Editor.saveQuest({
      slug: 'pending-quest',
      title: 'Старый квест',
      summary: 'Описание квеста.',
      body: 'Старый текст квеста.',
      publicationStatus: 'published',
    })
    questIds.push(quest.id)
    const [venue] = await useDatabase().insert(venues).values({
      slug: 'pending-venue',
      name: 'Кафе проверки',
      kind: 'cafe',
      description: 'Короткое описание.',
      status: 'published',
    }).returning()
    venueIds.push(venue!.id)

    enterContentScope('draft')
    await expect(saveCollectionDraft({
      id: collection.id,
      slug: collection.slug,
      title: collection.title,
      publicationStatus: 'published',
    })).rejects.toMatchObject({ statusCode: 403 })
    await expect(updateRouteDraft({
      id: route.id,
      publicationStatus: 'published',
    })).rejects.toMatchObject({ statusCode: 403 })
    expect(() => requireEditorContent('archive content')).toThrowError(expect.objectContaining({ statusCode: 403 }))
    expect(() => requireEditorContent('edit a venue listing')).toThrowError(expect.objectContaining({ statusCode: 403 }))
    await expect(writeQuest({
      id: quest.id,
      body: 'Новый текст квеста про площадь.',
    }, 'quest_update', { create: false })).rejects.toMatchObject({ statusCode: 409 })
    await expect(updateVenue({
      id: venue!.id,
      description: 'Другое описание заведения для проверки отказа.',
    })).rejects.toMatchObject({ statusCode: 409 })

    expect((await Editor.listCollections()).find((item) => item.id === collection.id)?.title).toBe('Старая подборка')
    expect((await Editor.listRoutes()).find((item) => item.id === route.id)?.title).toBe('Старый маршрут')
    expect((await Editor.questById(quest.id))?.body).toBe('Старый текст квеста.')
    expect(await Editor.contentDraft('collection', collection.id)).toBeNull()
    expect(await Editor.contentDraft('route', route.id)).toBeNull()
  })

  it('keeps a draft that changed while the admin save discarded the one it checked', async () => {
    await place('pending-stop-a', 'Первая остановка')
    const collection = await publishedCollection('pending-race-collection')
    enterContentScope('draft')
    await saveCollectionDraft({
      id: collection.id,
      slug: collection.slug,
      title: 'Черновик до правки',
      body: 'Текст черновика про ров.',
    })
    const checked = await Editor.contentDraft('collection', collection.id)
    enterContentScope('editor')
    await withPendingGuard('collection', collection.id, 'discard', async (tx) => {
      await useDatabase().update(contentDrafts).set({
        payload: { title: 'Свежий черновик', body: 'Текст, который пришёл во время сохранения.' },
        updatedAt: '2099-01-01T00:00:00.000Z',
      }).where(eq(contentDrafts.id, checked!.id))
      return Editor.saveCollection({
        id: collection.id,
        slug: collection.slug,
        title: 'Правка редактора',
        body: 'Текст формы на живой странице.',
        publicationStatus: 'published',
      }, null, tx)
    })
    const kept = await Editor.contentDraft('collection', collection.id)
    expect(kept?.id).toBe(checked?.id)
    expect(kept?.updatedAt).not.toBe(checked?.updatedAt)
    expect(kept?.payload).toMatchObject({ title: 'Свежий черновик' })
    expect((await Editor.listCollections()).find((item) => item.id === collection.id)?.title).toBe('Правка редактора')
  })
})

describe('draft token leaves a live gallery and schedule unchanged', () => {
  it('refuses a published or archived place and still lets the editor attach', async () => {
    const live = await place('pending-photo-place', 'Место с фото')
    const cover = await storedPhoto('place-cover')
    const extra = await storedPhoto('place-extra')
    enterContentScope('editor')
    await attachPlacePhoto({ placeId: live.id, mediaId: cover.id, isCover: true })

    enterContentScope('draft')
    await expect(attachPlacePhoto({ placeId: live.id, mediaId: extra.id, isCover: true })).rejects.toMatchObject(liveUnchanged)
    await expect(refuseIncomingPhoto(live.id)).rejects.toMatchObject(liveUnchanged)
    expect((await Content.galleryFor(live.id)).map((item) => ({ id: item.media.id, isCover: item.isCover }))).toEqual([
      { id: cover.id, isCover: true },
    ])

    enterContentScope('editor')
    await attachPlacePhoto({ placeId: live.id, mediaId: extra.id })
    expect((await Content.galleryFor(live.id)).map((item) => item.media.id).sort()).toEqual([cover.id, extra.id].sort())
    expect((await Content.galleryFor(live.id)).find((item) => item.isCover)?.media.id).toBe(cover.id)

    await Editor.savePlace({
      id: live.id,
      slug: live.slug,
      title: live.title,
      summary: live.summary,
      body: live.body,
      publicationStatus: 'archived',
    })
    enterContentScope('draft')
    await expect(attachPlacePhoto({ placeId: live.id, mediaId: extra.id, sortOrder: 4 })).rejects.toMatchObject(liveUnchanged)
    expect((await Content.galleryFor(live.id))).toHaveLength(2)
  })

  it('refuses a published collection cover, caption, and detach, and still lets the editor attach', async () => {
    await place('pending-stop-a', 'Первая остановка')
    const live = await publishedCollection('pending-photo-collection')
    const cover = await storedPhoto('collection-cover', 'Старая подпись')
    const extra = await storedPhoto('collection-extra')
    enterContentScope('editor')
    await attachCollectionPhoto({ collectionId: live.id, mediaId: cover.id, caption: 'Старая подпись' })

    enterContentScope('draft')
    await expect(attachCollectionPhoto({
      collectionId: live.id,
      mediaId: extra.id,
      isCover: true,
      caption: 'Новая подпись',
    })).rejects.toMatchObject(liveUnchanged)
    await expect(detachCollectionPhoto({ collectionId: live.id, mediaId: cover.id })).rejects.toMatchObject(liveUnchanged)
    await expect(refuseIncomingPhoto(undefined, live.id)).rejects.toMatchObject(liveUnchanged)
    const blocked = await Content.collectionGallery(live.id)
    expect(blocked.map((item) => ({ id: item.media.id, isCover: item.isCover, caption: item.media.caption }))).toEqual([
      { id: cover.id, isCover: true, caption: 'Старая подпись' },
    ])

    enterContentScope('editor')
    await attachCollectionPhoto({ collectionId: live.id, mediaId: extra.id })
    const opened = await Content.collectionGallery(live.id)
    expect(opened.map((item) => item.media.id).sort()).toEqual([cover.id, extra.id].sort())
    expect(opened.find((item) => item.isCover)?.media.id).toBe(cover.id)

    await Editor.saveCollection({
      id: live.id,
      slug: live.slug,
      title: live.title,
      body: live.body,
      publicationStatus: 'archived',
    })
    enterContentScope('draft')
    await expect(detachCollectionPhoto({ collectionId: live.id, mediaId: extra.id })).rejects.toMatchObject(liveUnchanged)
    expect(await Content.collectionGallery(live.id)).toHaveLength(2)

    const draftRow = await Editor.saveCollection({
      slug: 'pending-photo-draft-collection',
      title: 'Черновик подборки',
      body: 'Текст черновика подборки.',
      publicationStatus: 'draft',
    })
    collectionIds.push(draftRow.id)
    const draftPhoto = await storedPhoto('collection-draft')
    const attached = await attachCollectionPhoto({ collectionId: draftRow.id, mediaId: draftPhoto.id })
    expect(attached.isCover).toBe(true)
    expect(await Content.collectionGallery(draftRow.id)).toHaveLength(1)
  })

  it('refuses schedule and venue photo writes on a live page', async () => {
    const live = await place('pending-hours-place', 'Место с часами')
    const [venue] = await useDatabase().insert(venues).values({
      slug: 'pending-hours-venue',
      name: 'Кафе с часами',
      kind: 'cafe',
      description: 'Короткое описание.',
      status: 'published',
    }).returning()
    venueIds.push(venue!.id)
    enterContentScope('draft')
    await expect(assertScheduleWritable('place', live.id)).rejects.toMatchObject(liveUnchanged)
    await expect(assertScheduleWritable('venue', undefined, venue!.slug)).rejects.toMatchObject(liveUnchanged)
    await expect(refuseVenuePhoto(venue!.id)).rejects.toMatchObject(liveUnchanged)
    expect(await useDatabase().select().from(schedules).where(eq(schedules.entityId, live.id))).toEqual([])
    expect(await useDatabase().select().from(schedules).where(eq(schedules.entityId, venue!.id))).toEqual([])

    enterContentScope('editor')
    await expect(assertScheduleWritable('place', live.id)).resolves.toMatchObject({ id: live.id, slug: live.slug })
    await expect(refuseVenuePhoto(venue!.id)).resolves.toMatchObject({ id: venue!.id })
  })

  it('commons_import and media_upload_from_url refuse a live place and collection', async () => {
    await place('pending-stop-a', 'Первая остановка')
    const live = await place('pending-import-place', 'Место без фото')
    const collection = await publishedCollection('pending-import-collection')
    const commons = {
      fileUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/pending.jpg',
      pageUrl: 'https://commons.wikimedia.org/wiki/File:Pending.jpg',
      alt: 'Фото',
      author: 'Автор',
      license: 'cc0' as const,
    }
    const upload = {
      url: 'https://example.com/pending.jpg',
      alt: 'Фото',
      author: 'Автор',
      license: 'own' as const,
      sourceUrl: 'https://example.com/pending',
    }
    enterContentScope('draft')
    await expect(importCommonsPhoto({ ...commons, placeId: live.id })).rejects.toMatchObject(liveUnchanged)
    await expect(importCommonsPhoto({ ...commons, collectionId: collection.id })).rejects.toMatchObject(liveUnchanged)
    await expect(uploadMediaFromUrl({ ...upload, placeId: live.id })).rejects.toMatchObject(liveUnchanged)
    await expect(uploadMediaFromUrl({ ...upload, collectionId: collection.id })).rejects.toMatchObject(liveUnchanged)
    expect(await Content.galleryFor(live.id)).toEqual([])
    expect(await Content.collectionGallery(collection.id)).toEqual([])

    await Editor.savePlace({
      id: live.id,
      slug: live.slug,
      title: live.title,
      summary: live.summary,
      body: live.body,
      publicationStatus: 'archived',
    })
    await Editor.saveCollection({
      id: collection.id,
      slug: collection.slug,
      title: collection.title,
      body: collection.body,
      publicationStatus: 'archived',
    })
    await expect(importCommonsPhoto({ ...commons, placeId: live.id })).rejects.toMatchObject(liveUnchanged)
    await expect(uploadMediaFromUrl({ ...upload, collectionId: collection.id })).rejects.toMatchObject(liveUnchanged)
    expect(await Content.galleryFor(live.id)).toEqual([])
    expect(await Content.collectionGallery(collection.id)).toEqual([])
  })
})

describe('draft token leaves a public fact unchanged', () => {
  it('refuses fact_update on a live place or venue and lets the editor write', async () => {
    const live = await place('pending-fact-place', 'Место с телефоном')
    const stored = await phoneFact('place', live.id, '+7 4012 00-00-01')
    enterContentScope('draft')
    await expect(updateFact({
      id: stored.id,
      value: { text: '+7 4012 00-00-02' },
      sourceKind: 'official',
      confidence: 'stated',
    })).rejects.toMatchObject(liveUnchanged)
    expect((await Facts.byId(stored.id))?.value).toEqual({ text: '+7 4012 00-00-01' })

    enterContentScope('editor')
    const written = await updateFact({
      id: stored.id,
      value: { text: '+7 4012 00-00-02' },
      sourceKind: 'official',
      confidence: 'stated',
    })
    expect(written.conflict).toBe(false)
    expect((await Facts.byId(stored.id))?.value).toEqual({ text: '+7 4012 00-00-02' })

    await Editor.savePlace({
      id: live.id,
      slug: live.slug,
      title: live.title,
      summary: live.summary,
      body: live.body,
      publicationStatus: 'archived',
    })
    enterContentScope('draft')
    await expect(updateFact({
      id: stored.id,
      value: { text: '+7 4012 00-00-03' },
      sourceKind: 'official',
      confidence: 'stated',
    })).rejects.toMatchObject(liveUnchanged)
    expect((await Facts.byId(stored.id))?.value).toEqual({ text: '+7 4012 00-00-02' })

    const [venue] = await useDatabase().insert(venues).values({
      slug: 'pending-fact-venue',
      name: 'Кафе с телефоном',
      kind: 'cafe',
      description: 'Короткое описание.',
      status: 'published',
    }).returning()
    venueIds.push(venue!.id)
    const venueFact = await phoneFact('venue', venue!.id, '+7 4012 11-11-11')
    await expect(updateFact({
      id: venueFact.id,
      value: { text: '+7 4012 22-22-22' },
      sourceKind: 'official',
      confidence: 'stated',
    })).rejects.toMatchObject(liveUnchanged)
    expect((await Facts.byId(venueFact.id))?.value).toEqual({ text: '+7 4012 11-11-11' })

    await useDatabase().update(venues).set({ status: 'closed' }).where(eq(venues.id, venue!.id))
    await expect(updateFact({
      id: venueFact.id,
      value: { text: '+7 4012 33-33-33' },
      sourceKind: 'official',
      confidence: 'stated',
    })).rejects.toMatchObject(liveUnchanged)
    expect((await Facts.byId(venueFact.id))?.value).toEqual({ text: '+7 4012 11-11-11' })
  })

  it('refuses a live route, route stop, region, and an unknown subject', async () => {
    await place('pending-stop-a', 'Первая остановка')
    const live = await publishedRoute('pending-fact-route')
    const routeFact = await phoneFact('route', live.id, '+7 4012 40-00-01')
    const [point] = await useDatabase().select().from(routePoints).where(eq(routePoints.routeId, live.id))
    factSubjectIds.push(point!.id)
    const stopFact = await phoneFact('route_stop', point!.id, '+7 4012 40-00-02')
    const [region] = await useDatabase().insert(regions).values({
      slug: 'pending-fact-region',
      title: 'Край факта',
    }).returning()
    regionIds.push(region!.id)
    const regionFact = await phoneFact('region', region!.id, '+7 4012 40-00-03')

    enterContentScope('draft')
    const next = {
      value: { text: '+7 4012 40-00-09' },
      sourceKind: 'official' as const,
      confidence: 'stated' as const,
    }
    await expect(updateFact({ id: routeFact.id, ...next })).rejects.toMatchObject(liveUnchanged)
    await expect(updateFact({ id: stopFact.id, ...next })).rejects.toMatchObject(liveUnchanged)
    await expect(updateFact({ id: regionFact.id, ...next })).rejects.toMatchObject(liveUnchanged)
    await expect(refuseLiveFact('event', 'future-subject')).rejects.toMatchObject(liveUnchanged)
    await expect(refuseLiveFact('route', 'missing-route')).resolves.toBeUndefined()
    await expect(refuseLiveFact('route_stop', 'missing-stop')).resolves.toBeUndefined()
    await expect(refuseLiveFact('region', 'missing-region')).resolves.toBeUndefined()
    expect((await Facts.byId(routeFact.id))?.value).toEqual({ text: '+7 4012 40-00-01' })
    expect((await Facts.byId(stopFact.id))?.value).toEqual({ text: '+7 4012 40-00-02' })
    expect((await Facts.byId(regionFact.id))?.value).toEqual({ text: '+7 4012 40-00-03' })

    const draft = await Editor.saveRoute({
      slug: 'pending-fact-draft-route',
      title: 'Черновик маршрута',
      body: 'Текст черновика маршрута.',
      publicationStatus: 'draft',
    })
    routeIds.push(draft.id)
    const draftFact = await phoneFact('route', draft.id, '+7 4012 40-00-04')
    const written = await updateFact({
      id: draftFact.id,
      value: { text: '+7 4012 40-00-05' },
      sourceKind: 'official',
      confidence: 'stated',
    })
    expect(written.conflict).toBe(false)
    expect((await Facts.byId(draftFact.id))?.value).toEqual({ text: '+7 4012 40-00-05' })

    await Editor.saveRoute({
      id: live.id,
      slug: live.slug,
      title: live.title,
      body: live.body,
      publicationStatus: 'archived',
    })
    enterContentScope('draft')
    await expect(updateFact({ id: routeFact.id, ...next })).rejects.toMatchObject(liveUnchanged)
    await expect(updateFact({ id: stopFact.id, ...next })).rejects.toMatchObject(liveUnchanged)
    expect((await Facts.byId(routeFact.id))?.value).toEqual({ text: '+7 4012 40-00-01' })

    enterContentScope('editor')
    await expect(refuseLiveFact('event', 'future-subject')).resolves.toBeUndefined()
    const editorWritten = await updateFact({
      id: routeFact.id,
      value: { text: '+7 4012 40-00-06' },
      sourceKind: 'official',
      confidence: 'stated',
    })
    expect(editorWritten.conflict).toBe(false)
    expect((await Facts.byId(routeFact.id))?.value).toEqual({ text: '+7 4012 40-00-06' })
  })
})

describe('venue delete is editor-only', () => {
  it('refuses the draft token on an archived venue and lets the editor delete it', async () => {
    const [venue] = await useDatabase().insert(venues).values({
      slug: 'pending-delete-venue',
      name: 'Архивное кафе',
      kind: 'cafe',
      description: 'Короткое описание.',
      status: 'archived',
    }).returning()
    venueIds.push(venue!.id)
    enterContentScope('draft')
    await expect(deleteVenue({ id: venue!.id })).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'Draft token cannot delete a venue',
    })
    expect(await useDatabase().select().from(venues).where(eq(venues.id, venue!.id))).toHaveLength(1)

    enterContentScope('editor')
    await expect(deleteVenue({ id: venue!.id })).resolves.toMatchObject({ id: venue!.id, action: 'deleted' })
    expect(await useDatabase().select().from(venues).where(eq(venues.id, venue!.id))).toEqual([])
  })
})
