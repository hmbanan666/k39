import type { Collection } from '@k39/database'
import { describe, expect, it } from 'vitest'
import { collectionView } from '../server/utils/mcp/collections'

describe('collection_get', () => {
  it('returns sources, kind, and every other stored field', () => {
    const row = {
      id: 'col-october',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-13T00:00:00.000Z',
      slug: 'oktyabr',
      title: 'Октябрь в области',
      summary: 'Что открыто в октябре',
      body: 'Текст гида',
      seoTitle: 'Октябрь',
      seoDescription: 'Короткое описание',
      ogImage: '/media/october.jpg',
      publicationStatus: 'published',
      noindex: false,
      firstPublishedAt: '2026-10-01T00:00:00.000Z',
      updatedBy: 'user-1',
      kind: 'month',
      month: 10,
      sources: [{ title: 'Калининградстат', url: 'https://example.com/october' }],
    } satisfies Collection

    const view = collectionView(row, [{
      placeSlug: 'fort-11-denhoff',
      title: 'Форт № 11 Дёнхофф',
      note: 'Сначала сюда',
      position: 0,
    }])

    for (const key of Object.keys(row) as Array<keyof Collection>) {
      expect(view[key]).toEqual(row[key])
    }
    expect(view.kind).toBe('month')
    expect(view.sources).toEqual(row.sources)
    expect(view.items).toEqual([{
      placeSlug: 'fort-11-denhoff',
      slug: 'fort-11-denhoff',
      title: 'Форт № 11 Дёнхофф',
      note: 'Сначала сюда',
      position: 0,
    }])
    expect(view.article).toBe('body')
    expect(view.renderedFields).toContain('body')

    const theme = {
      ...row,
      id: 'col-forts',
      slug: 'otkrytye-forty',
      title: 'Открытые форты',
      kind: 'theme',
      month: null,
      sources: [],
      ogImage: null,
      updatedBy: null,
    } satisfies Collection
    const plain = collectionView(theme, [])
    expect(plain.kind).toBe('theme')
    expect(plain.month).toBeNull()
    expect(plain.sources).toEqual([])
    expect(plain.ogImage).toBeNull()
    expect(plain.updatedBy).toBeNull()
    expect(plain.items).toEqual([])
  })
})
