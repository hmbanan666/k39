import { beforeEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { collectionItems, collections, offers, places, quests, questSteps, routePoints, routes, slugRedirects } from '../../tables'
import { Content, Editor } from '../content'

async function resetStops() {
  const db = useDatabase()
  await db.delete(questSteps)
  await db.delete(quests)
  await db.delete(offers)
  await db.delete(routePoints)
  await db.delete(collectionItems)
  await db.delete(routes)
  await db.delete(collections)
  await db.delete(slugRedirects)
  await db.delete(places)
}

describe('ordered stops and archive', () => {
  beforeEach(async () => {
    await resetStops()
    await Editor.savePlace({
      slug: 'stop-live',
      title: 'Живой форт',
      summary: '',
      body: '',
      publicationStatus: 'published',
    })
    await Editor.savePlace({
      slug: 'stop-hidden',
      title: 'Черновик форта',
      summary: '',
      body: '',
      publicationStatus: 'draft',
    })
  })

  it('stores route points in order, keeps them when omitted, and rejects a missing slug', async () => {
    const route = await Editor.saveRoute({
      slug: 'ordered-route',
      title: 'Порядок',
      publicationStatus: 'published',
      points: [
        { placeSlug: 'stop-hidden', note: '  ' },
        { placeSlug: 'stop-live', note: 'С экскурсией' },
      ],
    })
    expect((await Editor.routePoints(route.id)).map((point) => [point.placeSlug, point.note, point.position])).toEqual([
      ['stop-hidden', null, 0],
      ['stop-live', 'С экскурсией', 1],
    ])
    const visible = await Content.publishedRoute('ordered-route')
    expect(visible?.points.map((point) => [point.slug, point.note, point.latitude, point.longitude])).toEqual([
      ['stop-live', 'С экскурсией', null, null],
    ])

    await Editor.saveRoute({
      id: route.id,
      slug: route.slug,
      title: 'Порядок без точек в запросе',
      publicationStatus: 'published',
    })
    expect((await Editor.routePoints(route.id)).map((point) => point.placeSlug)).toEqual(['stop-hidden', 'stop-live'])

    await expect(Editor.saveRoute({
      id: route.id,
      slug: route.slug,
      title: 'Не должно сохраниться',
      publicationStatus: 'published',
      points: [{ placeSlug: 'no-such-place' }],
    })).rejects.toThrow('Place not found: no-such-place')
    const kept = (await Editor.listRoutes()).find((item) => item.id === route.id)
    expect(kept?.title).toBe('Порядок без точек в запросе')
    expect(await Editor.routePoints(route.id)).toHaveLength(2)

    await Editor.saveRoute({
      id: route.id,
      slug: route.slug,
      title: kept?.title ?? route.title,
      publicationStatus: 'published',
      points: [
        { placeSlug: 'stop-live' },
        { placeSlug: 'stop-live', note: 'Второй заход' },
      ],
    })
    expect((await Editor.routePoints(route.id)).map((point) => [point.placeSlug, point.note])).toEqual([
      ['stop-live', null],
      ['stop-live', 'Второй заход'],
    ])

    await Editor.saveRoute({
      id: route.id,
      slug: route.slug,
      title: kept?.title ?? route.title,
      publicationStatus: 'published',
      points: [],
    })
    expect(await Editor.routePoints(route.id)).toEqual([])
  })

  it('returns place coordinates for a published route', async () => {
    await Editor.savePlace({
      slug: 'stop-live',
      title: 'Живой форт',
      summary: '',
      body: '',
      publicationStatus: 'published',
      latitude: 54.64528,
      longitude: 21.07472,
    })
    await Editor.saveRoute({
      slug: 'coord-route',
      title: 'С координатами',
      publicationStatus: 'published',
      points: [{ placeSlug: 'stop-live', note: 'У кассы' }],
    })
    const visible = await Content.publishedRoute('coord-route')
    expect(visible?.points).toEqual([
      expect.objectContaining({
        slug: 'stop-live',
        title: 'Живой форт',
        note: 'У кассы',
        latitude: 54.64528,
        longitude: 21.07472,
      }),
    ])
  })

  it('archives a published route, deletes a draft, and refuses a route a quest still links', async () => {
    const route = await Editor.saveRoute({
      slug: 'ordered-route',
      title: 'Порядок',
      publicationStatus: 'published',
      points: [{ placeSlug: 'stop-live', note: 'Открыт' }],
    })
    const archived = await Editor.archiveOrDeleteRoute(route.id)
    expect(archived).toMatchObject({ action: 'archived', slug: 'ordered-route', publicationStatus: 'archived' })
    expect(await Content.publishedRoute('ordered-route')).toBeNull()
    expect((await Content.sitemapRows()).routes.some((item) => item.loc === '/marshruty/ordered-route')).toBe(false)
    expect(await Content.redirects()).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromPath: '/marshruty/ordered-route', toPath: null, statusCode: 410 }),
    ]))
    expect(await Editor.routePoints(route.id)).toHaveLength(1)

    const republished = await Editor.saveRoute({
      id: route.id,
      slug: route.slug,
      title: route.title,
      publicationStatus: 'published',
    })
    expect(republished.publicationStatus).toBe('published')
    expect(await Content.publishedRoute('ordered-route')).not.toBeNull()
    expect((await Content.redirects()).some((item) => item.fromPath === '/marshruty/ordered-route')).toBe(false)

    const draft = await Editor.saveRoute({
      slug: 'draft-route',
      title: 'Черновик',
      points: [{ placeSlug: 'stop-live' }],
    })
    expect((await Editor.archiveOrDeleteRoute(draft.id))?.action).toBe('deleted')
    expect((await Editor.listRoutes()).some((item) => item.id === draft.id)).toBe(false)
    expect((await Content.redirects()).some((item) => item.fromPath === '/marshruty/draft-route')).toBe(false)

    const linked = await Editor.saveRoute({ slug: 'linked-route', title: 'Связан' })
    const quest = await Editor.saveQuest({ slug: 'linked-quest', title: 'Квест', routeId: linked.id })
    await expect(Editor.archiveOrDeleteRoute(linked.id)).rejects.toThrow('Cannot delete: a quest still links this route')
    expect((await Editor.listRoutes()).some((item) => item.id === linked.id)).toBe(true)

    const other = await Editor.saveRoute({ slug: 'other-route', title: 'Другой' })
    const moved = await Editor.saveQuest({
      id: quest.id,
      slug: quest.slug,
      title: quest.title,
      routeId: other.id,
    })
    expect(moved.routeId).toBe(other.id)
    expect((await Editor.archiveOrDeleteRoute(linked.id))?.action).toBe('deleted')
    expect((await Editor.questById(quest.id))?.routeId).toBe(other.id)

    const kept = await Editor.saveQuest({
      id: quest.id,
      slug: quest.slug,
      title: 'Квест без смены маршрута',
    })
    expect(kept.routeId).toBe(other.id)
    await Editor.saveQuest({
      id: quest.id,
      slug: quest.slug,
      title: quest.title,
      routeId: null,
    })
    expect((await Editor.questById(quest.id))?.routeId).toBeNull()
    expect((await Editor.archiveOrDeleteRoute(other.id))?.action).toBe('deleted')

    const review = await Editor.saveRoute({
      slug: 'review-route',
      title: 'На проверке',
      publicationStatus: 'review',
    })
    expect((await Editor.archiveOrDeleteRoute(review.id))?.action).toBe('archived')
    expect((await Content.redirects()).some((item) => item.fromPath === '/marshruty/review-route' && item.statusCode === 410)).toBe(true)
  })

  it('stores collection items and archives a published collection', async () => {
    await expect(Editor.saveCollection({
      slug: 'never-collection',
      title: 'Нет',
      items: [{ placeSlug: 'missing' }],
    })).rejects.toThrow('Place not found: missing')
    expect((await Editor.listCollections()).some((item) => item.slug === 'never-collection')).toBe(false)

    const collection = await Editor.saveCollection({
      slug: 'ordered-collection',
      title: 'Подборка',
      publicationStatus: 'published',
      items: [
        { placeSlug: 'stop-live', note: 'Сначала сюда' },
        { placeSlug: 'stop-hidden' },
      ],
    })
    expect((await Editor.collectionItems(collection.id)).map((item) => [item.placeSlug, item.note])).toEqual([
      ['stop-live', 'Сначала сюда'],
      ['stop-hidden', null],
    ])
    expect((await Content.publishedCollection('ordered-collection'))?.items.map((item) => item.slug)).toEqual(['stop-live'])

    await Editor.saveCollection({
      id: collection.id,
      slug: collection.slug,
      title: 'Подборка',
      publicationStatus: 'published',
    })
    expect(await Editor.collectionItems(collection.id)).toHaveLength(2)

    await Editor.saveCollection({
      id: collection.id,
      slug: collection.slug,
      title: 'Подборка',
      publicationStatus: 'published',
      items: [],
    })
    expect(await Editor.collectionItems(collection.id)).toEqual([])

    const draft = await Editor.saveCollection({ slug: 'draft-collection', title: 'Черновик подборки' })
    expect((await Editor.archiveOrDeleteCollection(draft.id))?.action).toBe('deleted')
    expect((await Editor.listCollections()).some((item) => item.id === draft.id)).toBe(false)

    const live = await Editor.saveCollection({
      slug: 'live-collection',
      title: 'Живая',
      publicationStatus: 'published',
      items: [{ placeSlug: 'stop-live', note: 'Остаётся' }],
    })
    expect((await Editor.archiveOrDeleteCollection(live.id))?.publicationStatus).toBe('archived')
    expect(await Content.publishedCollection('live-collection')).toBeNull()
    expect((await Content.sitemapRows()).collections.some((item) => item.loc === '/podborki/live-collection')).toBe(false)
    expect(await Editor.collectionItems(live.id)).toHaveLength(1)
    expect((await Content.redirects()).some((item) => item.fromPath === '/podborki/live-collection' && item.statusCode === 410)).toBe(true)
  })

  it('returns quest task text and only a published route', async () => {
    const live = await Editor.saveRoute({
      slug: 'live-ring',
      title: 'Живое кольцо',
      publicationStatus: 'published',
    })
    await Editor.saveQuest({
      slug: 'task-quest',
      title: 'Квест: кольцо',
      summary: 'Коротко о квесте по кольцу фортов.',
      body: '## Частые вопросы\n\n**Сколько точек?** Одна.',
      publicationStatus: 'published',
      routeId: live.id,
      steps: [{ placeSlug: 'stop-live', title: 'Живой форт', prompt: 'Найдите табличку у входа.' }],
    })
    const loaded = await Content.publishedQuest('task-quest')
    expect(loaded?.steps).toEqual([
      expect.objectContaining({
        slug: 'stop-live',
        title: 'Живой форт',
        prompt: 'Найдите табличку у входа.',
      }),
    ])
    expect(loaded?.route).toEqual({ slug: 'live-ring', title: 'Живое кольцо' })
    expect(loaded?.quest.body).toContain('## Частые вопросы')

    const draft = await Editor.saveRoute({
      slug: 'draft-ring',
      title: 'Черновик кольца',
      publicationStatus: 'draft',
    })
    await Editor.saveQuest({
      id: (await Editor.questBySlug('task-quest'))?.id,
      slug: 'task-quest',
      title: 'Квест: кольцо',
      publicationStatus: 'published',
      routeId: draft.id,
    })
    const retargeted = await Content.publishedQuest('task-quest')
    expect(retargeted?.route).toBeNull()
    expect(retargeted?.steps[0]?.prompt).toBe('Найдите табличку у входа.')
  })
})
