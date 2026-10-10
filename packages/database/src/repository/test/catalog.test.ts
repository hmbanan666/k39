import { describe, expect, it } from 'vitest'
import { applyInitialContent } from '../../seed/apply'
import { Content, Editor } from '../content'

describe('initial content', () => {
  it('publishes the fort seed and resolves a place', async () => {
    await applyInitialContent()
    await applyInitialContent()
    const loaded = await Content.publishedPlace('fort-11-denhoff')
    expect(loaded?.place.title).toContain('Дёнхофф')
    expect(loaded?.place.publicationStatus).toBe('published')
    expect(loaded?.nearest.length).toBeGreaterThan(0)
    const hidden = await Content.publishedPlace('does-not-exist')
    expect(hidden).toBeNull()
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
  })
})
