import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { applyInitialContent, INITIAL_CONTENT_IMPORT_ID } from '../../seed/apply'
import { CASTLE_REGIONS } from '../../seed/castle-regions'
import seed from '../../seed/initial-content.json'
import { categories, collectionItems, collections, contentImports, places, quests, questSteps, regions, revisions, routePoints, routes, slugRedirects, venueListingIntros, venueMedia, venues } from '../../tables'
import { Content, Editor } from '../content'

async function wipeContent() {
  const db = useDatabase()
  await db.delete(venueMedia)
  await db.delete(venueListingIntros)
  await db.delete(venues)
  await db.delete(questSteps)
  await db.delete(routePoints)
  await db.delete(collectionItems)
  await db.delete(revisions)
  await db.delete(quests)
  await db.delete(routes)
  await db.delete(collections)
  await db.delete(places)
  await db.delete(categories)
  await db.delete(regions)
  await db.delete(slugRedirects)
  await db.delete(contentImports)
}

describe('castle regions', () => {
  it('points each named castle at its town in the migration', () => {
    const path = [
      resolve(process.cwd(), 'migrations/0006_castle_regions.sql'),
      resolve(process.cwd(), 'packages/database/migrations/0006_castle_regions.sql'),
    ].find((item) => existsSync(item))
    const sql = readFileSync(path ?? '', 'utf8')
    for (const [place, region] of CASTLE_REGIONS) {
      expect(sql).toContain(`'${place}'`)
      expect(sql).toContain(`'${region}'`)
    }
  })
})

describe('initial content', () => {
  beforeEach(async () => {
    await wipeContent()
  })

  it('imports once, then leaves admin edits and timestamps alone', async () => {
    const first = await applyInitialContent()
    expect(first.skipped).toBe(false)
    const loaded = await Content.publishedPlace('fort-11-denhoff')
    expect(loaded?.place.title).toContain('Дёнхофф')
    expect(loaded?.place.publicationStatus).toBe('published')
    expect(loaded?.nearest.length).toBeGreaterThan(0)
    const forty = await Content.categoryBySlug('forty')
    expect(forty?.body).toContain('## Частые вопросы')
    const quest = await Content.publishedQuest('pyat-fortov')
    expect(quest?.route).toEqual({ slug: 'pyat-fortov', title: 'Пять фортов за один выезд' })
    expect(quest?.steps[0]?.prompt).toContain('Отметьте визит')
    expect(quest?.quest.body).toContain('## Частые вопросы')
    const hidden = await Content.publishedPlace('does-not-exist')
    expect(hidden).toBeNull()

    const stamped = loaded?.place.updatedAt
    const pointsBefore = await useDatabase().select().from(routePoints)
    const second = await applyInitialContent()
    expect(second.skipped).toBe(true)
    const reread = await Editor.placeBySlug('fort-11-denhoff')
    expect(reread?.updatedAt).toBe(stamped)
    expect(reread?.title).toBe(loaded?.place.title)
    expect(await useDatabase().select().from(routePoints)).toEqual(pointsBefore)

    await Editor.savePlace({
      slug: 'draft-only',
      title: 'Черновик',
      summary: 'Текст черновика, которого не должно быть в карте сайта.',
      body: 'Черновик',
      publicationStatus: 'draft',
    })
    const map = await Content.sitemapRows()
    expect(map.places.some((row) => row.loc === '/fort-11-denhoff')).toBe(true)
    expect(map.places.some((row) => row.loc === '/draft-only')).toBe(false)
    expect(map.routes.some((row) => row.loc === '/marshruty/pyat-fortov')).toBe(true)
    expect(map.quests.some((row) => row.loc === '/kvesty/pyat-fortov')).toBe(true)

    const edited = await Editor.savePlace({
      id: reread?.id,
      slug: 'fort-11-posle-pravki',
      title: 'Правка редактора',
      summary: reread?.summary ?? '',
      body: 'Текст, который повторный запуск не должен затереть.',
      status: reread?.status ?? 'unknown',
      publicationStatus: 'draft',
      sources: reread?.sources ?? [],
    })
    const third = await applyInitialContent()
    expect(third.skipped).toBe(true)
    const survived = await Editor.placeById(edited.id)
    expect(survived?.title).toBe('Правка редактора')
    expect(survived?.slug).toBe('fort-11-posle-pravki')
    expect(survived?.publicationStatus).toBe('draft')
    expect(survived?.body).toContain('повторный запуск')
    expect(survived?.updatedAt).toBe(edited.updatedAt)
    expect(await Editor.placeBySlug('fort-11-denhoff')).toBeUndefined()
    expect(await useDatabase().select().from(routePoints)).toEqual(pointsBefore)

    await useDatabase().delete(contentImports).where(eq(contentImports.id, INITIAL_CONTENT_IMPORT_ID))
    const fourth = await applyInitialContent()
    expect(fourth.skipped).toBe(false)
    const still = await Editor.placeById(edited.id)
    expect(still?.title).toBe('Правка редактора')
    expect(still?.publicationStatus).toBe('draft')
    expect(still?.updatedAt).toBe(edited.updatedAt)
  })

  it('publishes empty legacy drafts and leaves an edited row alone', async () => {
    const db = useDatabase()
    expect(seed.places).toHaveLength(27)
    for (const place of seed.places) {
      await db.insert(places).values({
        slug: place.slug,
        title: place.slug,
        latitude: 0,
        longitude: 0,
        summary: '',
        body: '',
        publicationStatus: 'draft',
      })
    }
    const [oldRoute] = await db.insert(routes).values({
      slug: 'five-forts',
      title: 'Старый маршрут',
      summary: 'Сводка из прежней схемы',
      body: '',
      publicationStatus: 'draft',
    }).returning()
    await db.insert(quests).values({
      slug: 'five-forts',
      title: 'Старый квест',
      body: '',
      publicationStatus: 'draft',
      routeId: oldRoute?.id,
    })
    await db.insert(contentImports).values({ id: INITIAL_CONTENT_IMPORT_ID })
    const [edited] = await db.insert(places).values({
      slug: 'redaktorskaya-pravka',
      title: 'Оставить как есть',
      summary: 'Коротко от редактора',
      body: 'Текст редактора, который сид не затирает.',
      publicationStatus: 'draft',
    }).returning()

    const result = await applyInitialContent()
    expect(result.skipped).toBe(false)
    expect(result.filled).toBe(27)

    const map = await Content.sitemapRows()
    for (const place of seed.places) {
      const row = await Editor.placeBySlug(place.slug)
      expect(row?.publicationStatus).toBe('published')
      expect(row?.title).toBe(place.title)
      expect(row?.summary).toBe(place.summary)
      expect(row?.body).toBe(place.body)
      expect(row?.latitude).toBe(place.latitude)
      expect(row?.categoryId).toBeTruthy()
      expect(map.places.some((item) => item.loc === `/${place.slug}`)).toBe(true)
      expect(await Content.publishedPlace(place.slug)).not.toBeNull()
    }

    const kept = await Editor.placeById(edited?.id ?? '')
    expect(kept?.title).toBe('Оставить как есть')
    expect(kept?.body).toBe('Текст редактора, который сид не затирает.')
    expect(kept?.publicationStatus).toBe('draft')
    expect(kept?.updatedAt).toBe(edited?.updatedAt)
    expect(map.places.some((item) => item.loc === '/redaktorskaya-pravka')).toBe(false)

    const parkedRoute = await Editor.listRoutes()
    expect(parkedRoute.find((row) => row.slug === 'five-forts')?.publicationStatus).toBe('draft')
    const parkedQuest = await db.select().from(quests).where(eq(quests.slug, 'five-forts'))
    expect(parkedQuest[0]?.publicationStatus).toBe('draft')
    expect(parkedQuest[0]?.routeId).toBe(oldRoute?.id)
    const redirects = await db.select().from(slugRedirects)
    expect(redirects).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromPath: '/marshruty/five-forts', toPath: '/marshruty/pyat-fortov', statusCode: 301 }),
      expect.objectContaining({ fromPath: '/kvesty/five-forts', toPath: '/kvesty/pyat-fortov', statusCode: 301 }),
    ]))
    expect(map.routes.some((item) => item.loc.includes('five-forts'))).toBe(false)
    expect(map.quests.some((item) => item.loc.includes('five-forts'))).toBe(false)

    const stamp = (await Editor.placeBySlug('fort-11-denhoff'))?.updatedAt
    const again = await applyInitialContent()
    expect(again.skipped).toBe(true)
    expect((await Editor.placeBySlug('fort-11-denhoff'))?.updatedAt).toBe(stamp)
  })

  it('publishes, unpublishes, and redirects a renamed slug', async () => {
    const created = await Editor.savePlace({
      slug: 'mcp-fort',
      title: 'Форт для проверки',
      summary: '',
      body: '',
      publicationStatus: 'draft',
    })
    const published = await Editor.savePlace({
      id: created.id,
      slug: created.slug,
      title: created.title,
      summary: '',
      body: '',
      publicationStatus: 'published',
    })
    expect(published.publicationStatus).toBe('published')
    const live = await Content.sitemapRows()
    expect(live.places.some((row) => row.loc === '/mcp-fort')).toBe(true)

    const renamed = await Editor.savePlace({
      id: created.id,
      slug: 'mcp-fort-new',
      title: created.title,
      summary: '',
      body: '',
      publicationStatus: 'published',
    })
    const redirects = await Content.redirects()
    expect(redirects).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromPath: '/mcp-fort', toPath: '/mcp-fort-new', statusCode: 301 }),
    ]))

    const unpublished = await Editor.savePlace({
      id: renamed.id,
      slug: renamed.slug,
      title: renamed.title,
      summary: '',
      body: '',
      publicationStatus: 'draft',
    })
    expect(unpublished.publicationStatus).toBe('draft')
    const after = await Content.sitemapRows()
    expect(after.places.some((row) => row.loc === '/mcp-fort-new')).toBe(false)
    expect(after.places.some((row) => row.loc === '/mcp-fort')).toBe(false)
  })
})
