import { describe, expect, it } from 'vitest'
import { collectionDraftChanges, routeDraftChanges } from '../shared/content-draft-diff'

describe('collection and route draft diff', () => {
  it('lists collection fields that would change', () => {
    const changes = collectionDraftChanges({
      title: 'Старая',
      slug: 'old',
      summary: 'Кратко',
      body: 'Старый текст',
      seoTitle: null,
      seoDescription: null,
      ogImage: null,
      noindex: false,
      kind: 'theme',
      month: null,
      sources: [],
      modules: [],
      items: [{ placeSlug: 'fort', note: null }],
      publicationStatus: 'published',
    }, {
      title: 'Новая',
      slug: 'old',
      summary: 'Кратко',
      body: 'Новый текст',
      seoTitle: null,
      seoDescription: null,
      ogImage: null,
      noindex: false,
      kind: 'theme',
      month: null,
      sources: [],
      modules: [{ type: 'text', text: 'Лид' }],
      items: [{ placeSlug: 'fort', note: 'потом' }],
      publicationStatus: 'published',
    })
    expect(changes.map((item) => item.field)).toEqual(['title', 'body', 'items', 'modules'])
    expect(changes.find((item) => item.field === 'items')).toMatchObject({
      live: 'fort',
      draft: 'fort: потом',
    })
  })

  it('lists a route line and stops', () => {
    const changes = routeDraftChanges({
      title: 'Маршрут',
      slug: 'route',
      summary: null,
      body: 'Текст',
      seoTitle: null,
      seoDescription: null,
      ogImage: null,
      noindex: false,
      points: [],
      path: null,
      publicationStatus: 'published',
    }, {
      title: 'Маршрут',
      slug: 'route',
      summary: null,
      body: 'Текст',
      seoTitle: null,
      seoDescription: null,
      ogImage: null,
      noindex: true,
      points: [{ placeSlug: 'fort', note: 'старт' }],
      path: [[20.5, 54.7]],
      publicationStatus: 'published',
    })
    expect(changes.map((item) => item.field)).toEqual(['points', 'path', 'noindex'])
    expect(changes.find((item) => item.field === 'path')?.draft).toBe('20.5, 54.7')
    expect(changes.find((item) => item.field === 'noindex')).toMatchObject({
      live: 'в индексе',
      draft: 'не индексировать',
    })
  })
})
