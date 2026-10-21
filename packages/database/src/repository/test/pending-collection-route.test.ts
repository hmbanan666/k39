// Lives in the database suite so it uses that Postgres.
// Typechecked from apps/web-app/tsconfig.writer-test.json, where Nuxt
// auto-imports exist. This package's tsc excludes the file.
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { enterContentScope, requireEditorContent } from '../../../../../apps/web-app/server/utils/access'
import { applyAdminContentDraft, collectionDraftNotice, discardAdminContentDraft, routeDraftNotice, withPendingGuard } from '../../../../../apps/web-app/server/utils/admin/content-draft'
import { readCollection, saveCollectionDraft } from '../../../../../apps/web-app/server/utils/mcp/collections'
import { setPublication } from '../../../../../apps/web-app/server/utils/mcp/publish'
import { writeQuest } from '../../../../../apps/web-app/server/utils/mcp/quests'
import { readRoute, updateRouteDraft } from '../../../../../apps/web-app/server/utils/mcp/routes'
import { updateVenue } from '../../../../../apps/web-app/server/utils/venues/write'
import { renderMarkdown } from '../../../../../apps/web-app/shared/markdown'
import { toPublicModules } from '../../../../../apps/web-app/shared/page-modules'
import { bodyOf } from '../../body-sections'
import { useDatabase } from '../../database'
import { collections, contentDrafts, mcpAudits, pageReviews, places, quests, revisions, routes, slugRedirects, venues, verificationQueue } from '../../tables'
import { Content, Editor } from '../content'

function expectApplied(result: object) {
  if (!('pendingReview' in result)) {
    throw new Error('publish response omitted pendingReview')
  }
  expect(result.pendingReview).toBe(false)
}

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
const redirectPaths: string[] = []

afterEach(async () => {
  enterContentScope('editor')
  const database = useDatabase()
  for (const id of [...placeIds, ...routeIds, ...collectionIds, ...questIds, ...venueIds]) {
    await database.delete(verificationQueue).where(eq(verificationQueue.entityId, id))
    await database.delete(pageReviews).where(eq(pageReviews.entityId, id))
    await database.delete(contentDrafts).where(eq(contentDrafts.entityId, id))
    await database.delete(revisions).where(eq(revisions.entityId, id))
    await database.delete(mcpAudits).where(eq(mcpAudits.entityId, id))
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
  placeIds.length = 0
  routeIds.length = 0
  collectionIds.length = 0
  questIds.length = 0
  venueIds.length = 0
  redirectPaths.length = 0
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
    expectApplied(published)
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
    expectApplied(published)
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

    await withPendingGuard('route', route.id, 'discard', async () => {
      await Editor.saveRoute({
        id: route.id,
        slug: route.slug,
        title: 'Правка редактора',
        body: 'Текст формы редактора на живой странице.',
        publicationStatus: 'published',
      })
    })
    expect((await Editor.listRoutes()).find((item) => item.id === route.id)?.title).toBe('Правка редактора')
    expect(await Editor.contentDraft('route', route.id)).toBeNull()

    const applied = await applyAdminContentDraft('collection', collection.id)
    expectApplied(applied)
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
})
