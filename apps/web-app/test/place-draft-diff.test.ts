import type { PlaceDraftSide } from '../shared/place-draft-diff'
import { describe, expect, it } from 'vitest'
import { formatDraftUpdated, placeDraftChanges } from '../shared/place-draft-diff'

function side(patch: Partial<PlaceDraftSide> = {}): PlaceDraftSide {
  return {
    title: 'Форт',
    slug: 'fort',
    summary: 'Кирпичный форт у посёлка.',
    body: 'Старый текст.',
    status: 'ruins',
    hours: null,
    price: null,
    howToGet: null,
    latitude: 54.7,
    longitude: 20.5,
    categoryId: 'cat-fort',
    regionId: null,
    sources: [],
    seoTitle: null,
    seoDescription: null,
    ogImage: null,
    noindex: false,
    visitDuration: 'час',
    bestTime: null,
    faq: [],
    lastVerifiedAt: null,
    authorKind: 'human',
    publicationStatus: 'published',
    ...patch,
  }
}

describe('place draft diff', () => {
  it('lists only fields that would change, in reading order', () => {
    const changes = placeDraftChanges(side(), side({
      title: 'Форт № 11',
      body: 'Новый текст про вал и ров.',
      hours: '10:00–18:00',
      faq: [{ question: 'Где вход?', answer: 'Со стороны шоссе.' }],
    }), {
      category: new Map([['cat-fort', 'Форты']]),
    })
    expect(changes.map((item) => item.field)).toEqual(['title', 'body', 'hours', 'faq'])
    expect(changes[0]).toEqual({ field: 'title', label: 'Название', live: 'Форт', draft: 'Форт № 11' })
    expect(changes.find((item) => item.field === 'hours')).toMatchObject({ live: 'пусто', draft: '10:00–18:00' })
    expect(changes.find((item) => item.field === 'faq')?.draft).toBe('Где вход?\nСо стороны шоссе.')
  })

  it('treats an empty string and null as the same empty field', () => {
    expect(placeDraftChanges(side({ hours: null }), side({ hours: '' }))).toEqual([])
    expect(placeDraftChanges(side({ latitude: 54.7 }), side({ latitude: 54.70 }))).toEqual([])
  })

  it('names a category and a publication change', () => {
    const changes = placeDraftChanges(
      side({ categoryId: 'cat-fort', publicationStatus: 'archived' }),
      side({ categoryId: 'cat-beach', publicationStatus: 'published' }),
      { category: new Map([['cat-fort', 'Форты'], ['cat-beach', 'Пляжи']]) },
    )
    expect(changes.map((item) => item.field)).toEqual(['categoryId', 'publicationStatus'])
    expect(changes[0]).toMatchObject({ live: 'Форты', draft: 'Пляжи' })
    expect(changes[1]).toMatchObject({ live: 'в архиве', draft: 'опубликовано' })
  })

  it('formats the draft timestamp in Kaliningrad', () => {
    expect(formatDraftUpdated('2026-10-16T12:00:00.000Z')).toContain('16')
    expect(formatDraftUpdated('2026-10-16T12:00:00.000Z')).toContain('Сохранён')
    expect(formatDraftUpdated('not-a-date')).toBe('Сохранён')
  })
})
