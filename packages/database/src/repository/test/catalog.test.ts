import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { applyInitialContent, INITIAL_CONTENT_IMPORT_ID } from '../../seed/apply'
import { contentImports, routePoints } from '../../tables'
import { Content, Editor } from '../content'

describe('initial content', () => {
  it('imports once, then leaves admin edits and timestamps alone', async () => {
    const first = await applyInitialContent()
    expect(first.skipped).toBe(false)
    const loaded = await Content.publishedPlace('fort-11-denhoff')
    expect(loaded?.place.title).toContain('Дёнхофф')
    expect(loaded?.place.publicationStatus).toBe('published')
    expect(loaded?.nearest.length).toBeGreaterThan(0)
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
})
