import type { CatalogArticle, ContentCatalog, ScorePlace } from '@k39/database'
import { describe, expect, it } from 'vitest'
import { scoresFromCatalog } from '../server/utils/scoring/assemble'
import { catalogWithPendingPlace, scorePreview } from '../server/utils/scoring/preview'

const NOW = new Date('2026-10-21T00:00:00.000Z')

function place(patch: Partial<ScorePlace> = {}): ScorePlace {
  return {
    id: 'place-1',
    slug: 'fort-a',
    title: 'Форт А',
    summary: 'Коротко.',
    body: 'Живой текст страницы.',
    howToGet: null,
    hours: null,
    price: null,
    latitude: null,
    longitude: null,
    publicationStatus: 'published',
    noindex: false,
    seoTitle: null,
    seoDescription: null,
    factsCheckedAt: null,
    sources: [],
    faq: [],
    faqCount: 0,
    categorySlug: 'forty',
    categoryTitle: 'Форты',
    regionId: null,
    regionTitle: null,
    updatedAt: '2026-10-12T00:00:00.000Z',
    ...patch,
  }
}

function route(patch: Partial<CatalogArticle> = {}): CatalogArticle {
  return {
    id: 'route-1',
    slug: 'chernovik',
    title: 'Черновик маршрута',
    summary: '',
    body: 'Текст черновика.',
    publicationStatus: 'review',
    noindex: false,
    seoTitle: null,
    seoDescription: null,
    updatedAt: '2026-10-12T00:00:00.000Z',
    routeSlug: null,
    modules: [],
    sourcesCount: 0,
    ...patch,
  }
}

function catalog(patch: Partial<ContentCatalog> = {}): ContentCatalog {
  return {
    places: [],
    routes: [],
    routeStops: [],
    collections: [],
    collectionStops: [],
    quests: [],
    questStops: [],
    hubs: [],
    venues: [],
    related: [],
    photos: [],
    venuePhotos: [],
    passports: [],
    ...patch,
  }
}

describe('content score preview', () => {
  it('scores a published row the same way as the stored scorer and marks it live', () => {
    const rows = catalog({ places: [place()] })
    const stored = scoresFromCatalog(rows, [], [], false, NOW)
    const preview = scorePreview({
      catalog: rows,
      pageType: 'place',
      entityId: 'place-1',
      source: 'live',
      publicationStatus: 'published',
      now: NOW,
    })
    expect(stored).toHaveLength(1)
    expect(preview).toMatchObject({
      preview: true,
      source: 'live',
      resultsApplicable: true,
      path: '/fort-a',
      total: stored[0]!.total,
      quality: stored[0]!.quality,
      linking: stored[0]!.linking,
      indexing: stored[0]!.indexing,
      results: stored[0]!.results,
    })
    expect(preview?.note).toContain('live row')
    expect(preview?.note).toContain('Not written')
  })

  it('scores a draft row that the stored scorer skips, without a traffic block', () => {
    const rows = catalog({ places: [place({ publicationStatus: 'draft', body: 'Короткий черновик.' })] })
    expect(scoresFromCatalog(rows, [], [], false, NOW).map((row) => row.path)).not.toContain('/fort-a')
    const included = scoresFromCatalog(rows, [], [], false, NOW, undefined, { include: [{ kind: 'place', id: 'place-1' }] })
    const preview = scorePreview({
      catalog: rows,
      pageType: 'place',
      entityId: 'place-1',
      source: 'draft',
      publicationStatus: 'draft',
      now: NOW,
    })
    const indexing = Math.min(100, included[0]!.indexing + 40)
    expect(included[0]!.checks.indexing).toEqual(expect.arrayContaining(['not 200', 'not in sitemap']))
    expect(preview).toMatchObject({
      preview: true,
      source: 'draft',
      resultsApplicable: false,
      publicationStatus: 'draft',
      results: null,
      quality: included[0]!.quality,
      linking: included[0]!.linking,
      indexing,
    })
    expect(preview?.checks.indexing).toEqual(expect.arrayContaining([
      'not 200: not applicable',
      'not in sitemap: not applicable',
    ]))
    expect(preview?.checks.indexing).not.toContain('not 200')
    expect(preview?.checks.indexing).not.toContain('not in sitemap')
    expect(preview?.notApplicable).toEqual(expect.arrayContaining(['results', 'not 200', 'not in sitemap']))
    expect(preview?.checks.results).toEqual(['not applicable'])
    expect(preview?.total).toBe(Math.round((included[0]!.quality + included[0]!.linking + indexing) / 3))
    expect(preview?.note).toContain('draft row')
    expect(preview?.note).toContain('not applicable')
  })

  it('keeps the sitemap penalty when a draft is noindex', () => {
    const rows = catalog({ places: [place({ publicationStatus: 'draft', noindex: true })] })
    const included = scoresFromCatalog(rows, [], [], false, NOW, undefined, { include: [{ kind: 'place', id: 'place-1' }] })
    const preview = scorePreview({
      catalog: rows,
      pageType: 'place',
      entityId: 'place-1',
      source: 'draft',
      publicationStatus: 'draft',
      now: NOW,
    })
    expect(included[0]!.checks.indexing).toEqual(expect.arrayContaining(['noindex', 'not in sitemap', 'not 200']))
    expect(preview?.indexing).toBe(included[0]!.indexing + 20)
    expect(preview?.checks.indexing).toEqual(expect.arrayContaining(['noindex', 'not in sitemap', 'not 200: not applicable']))
    expect(preview?.notApplicable).toContain('not 200')
    expect(preview?.notApplicable).not.toContain('not in sitemap')
  })

  it('scores a review route from that row', () => {
    const rows = catalog({ routes: [route()] })
    expect(scoresFromCatalog(rows, [], [], false, NOW)).toEqual([])
    const included = scoresFromCatalog(rows, [], [], false, NOW, undefined, { include: [{ kind: 'route', id: 'route-1' }] })
    const preview = scorePreview({
      catalog: rows,
      pageType: 'route',
      entityId: 'route-1',
      source: 'draft',
      publicationStatus: 'review',
      now: NOW,
    })
    expect(preview).toMatchObject({
      source: 'draft',
      path: '/marshruty/chernovik',
      publicationStatus: 'review',
      resultsApplicable: false,
      results: null,
      indexing: Math.min(100, included[0]!.indexing + 40),
    })
    expect(preview?.checks.indexing).toEqual(expect.arrayContaining([
      'not 200: not applicable',
      'not in sitemap: not applicable',
    ]))
  })

  it('scores a pending payload instead of the live body and leaves the catalog score untouched', () => {
    const live = place({ body: 'Живой текст.' })
    const rows = catalog({ places: [live] })
    const pendingBody = 'Черновик правки. '.repeat(40)
    const overlaid = catalogWithPendingPlace(rows, 'place-1', {
      slug: 'fort-a',
      title: 'Форт А',
      summary: 'Коротко.',
      body: pendingBody,
      howToGet: 'Автобус 40 до кольца.',
      hours: null,
      price: null,
      latitude: null,
      longitude: null,
      regionId: null,
      noindex: false,
      seoTitle: null,
      seoDescription: null,
      sources: [{ title: 'Музей', url: 'https://example.com/fort' }],
      faq: [{ question: 'Можно ли войти?', answer: 'Да, в часы музея.' }],
      lastVerifiedAt: null,
    }, {
      categorySlug: 'forty',
      categoryTitle: 'Форты',
      regionTitle: null,
    })
    const stored = scoresFromCatalog(rows, [], [], false, NOW)
    const overlaidScore = scoresFromCatalog(overlaid, [], [], false, NOW)
    const preview = scorePreview({
      catalog: overlaid,
      pageType: 'place',
      entityId: 'place-1',
      source: 'pending',
      publicationStatus: 'published',
      now: NOW,
    })
    expect(rows.places[0]?.body).toBe('Живой текст.')
    expect(preview?.source).toBe('pending')
    expect(preview?.resultsApplicable).toBe(false)
    expect(preview?.results).toBeNull()
    expect(preview?.checks.results).toEqual(['not applicable'])
    expect(preview?.indexing).toBe(overlaidScore[0]!.indexing)
    expect(preview?.checks.indexing).toEqual(overlaidScore[0]!.checks.indexing)
    expect(preview?.checks.indexing.join(' ')).not.toContain('not applicable')
    expect(preview?.notApplicable).toEqual(['results'])
    expect(Number(preview?.signals.bodyChars)).toBeGreaterThan(Number(stored[0]?.signals.bodyChars))
    expect(preview?.note).toContain('pending payload')
    expect(preview?.note).not.toContain('sitemap')
    expect(stored[0]?.signals.bodyChars).not.toBe(preview?.signals.bodyChars)
  })
})
