import type { ScoreSource } from '../shared/scoring'
import { describe, expect, it } from 'vitest'
import { emptyResults, scorePage } from '../shared/scoring'
import { venueDocument, venueSchemaType } from '../shared/seo'

function venue(patch: Partial<ScoreSource> = {}): ScoreSource {
  return {
    kind: 'venue',
    id: 'venue-1',
    path: '/zavedeniya/kofeynya-u-forta',
    title: 'Кофейня у форта номер одиннадцать',
    summary: 'Описание кофейни у форта для гостей.',
    body: '',
    howToGet: null,
    hours: null,
    price: null,
    categorySlug: 'coffee',
    categoryTitle: null,
    regionTitle: 'Калининград',
    latitude: null,
    longitude: null,
    sources: [],
    publicationStatus: 'published',
    noindex: true,
    seoTitle: null,
    seoDescription: 'Кофейня у форта Дёнхофф: часы, средний чек и как дойти от ворот. Карточка проверена редактором.',
    factsCheckedAt: null,
    photoCount: 0,
    inRoute: false,
    inCollection: false,
    memberCount: 0,
    inbound: 1,
    contentOutbound: 2,
    orphan: false,
    passport: {
      targetQueries: ['кофейня у форта'],
      audience: 'гости форта',
      primaryAction: 'claim_offer',
      goal30d: 10,
      goal90d: 40,
      notes: null,
    },
    results: emptyResults(),
    ...patch,
  }
}

describe('venue scores', () => {
  it('checks description, photo, hours, verification, and coordinates', () => {
    const thin = scorePage(venue(), new Date('2026-10-13T00:00:00.000Z'))
    expect(thin.checks.quality).toEqual(expect.arrayContaining([
      'description missing',
      '0 photos',
      'no hours',
      'facts not checked',
      'no coordinates',
    ]))
    const text = 'Кофейня у форта варит эспрессо и кормит обедом после экскурсии. '.repeat(8).slice(0, 450)
    const ready = scorePage(venue({
      body: text,
      summary: text,
      hours: 'set',
      photoCount: 1,
      latitude: 54.65,
      longitude: 20.56,
      factsCheckedAt: '2026-10-01T00:00:00.000Z',
      noindex: false,
    }), new Date('2026-10-13T00:00:00.000Z'))
    expect(ready.checks.quality).not.toEqual(expect.arrayContaining([
      'description missing',
      '0 photos',
      'no hours',
      'facts not checked',
      'no coordinates',
    ]))
    expect(ready.quality).toBeGreaterThan(thin.quality)
  })
})

describe('venue json-ld', () => {
  it('uses CafeOrCoffeeShop for coffee and hides a page without a description', () => {
    expect(venueSchemaType('coffee')).toBe('CafeOrCoffeeShop')
    expect(venueSchemaType('cafe')).toBe('CafeOrCoffeeShop')
    expect(venueSchemaType('restaurant')).toBe('Restaurant')
    expect(venueSchemaType('market')).toBe('LocalBusiness')
    const hidden = venueDocument({
      slug: 'bez-teksta',
      name: 'Без текста',
      kind: 'cafe',
      description: '',
    })
    expect(hidden.robots).toContain('noindex')
    const live = venueDocument({
      slug: 'kofeynya-u-forta',
      name: 'Кофейня у форта',
      kind: 'coffee',
      description: 'Кофейня у форта варит эспрессо и кормит обедом. '.repeat(8),
      latitude: 54.65,
      longitude: 20.56,
      hours: [{ weekday: 'mon', opens: '09:00', closes: '18:00' }],
    })
    expect(live.robots).toBe('index, follow, max-image-preview:large')
    expect(live.jsonLd.map((node) => node['@type'])).toEqual(['BreadcrumbList', 'CafeOrCoffeeShop'])
    expect(JSON.stringify(live.jsonLd)).toContain('OpeningHoursSpecification')
    const unknown = venueDocument({
      slug: 'bez-chasov',
      name: 'Без часов',
      kind: 'cafe',
      description: 'Кафе без расписания на карточке. '.repeat(12),
      hours: [
        { weekday: 'mon', closed: true, opens: null, closes: null },
        { weekday: 'tue', closed: true, opens: null, closes: null },
        { weekday: 'wed', closed: true, opens: null, closes: null },
        { weekday: 'thu', closed: true, opens: null, closes: null },
        { weekday: 'fri', closed: true, opens: null, closes: null },
        { weekday: 'sat', closed: true, opens: null, closes: null },
        { weekday: 'sun', closed: true, opens: null, closes: null },
      ],
    })
    expect(JSON.stringify(unknown.jsonLd)).not.toContain('openingHours')
    const omitted = venueDocument({
      slug: 'bez-chasov',
      name: 'Без часов',
      kind: 'cafe',
      description: 'Кафе без расписания на карточке. '.repeat(12),
    })
    expect(JSON.stringify(omitted.jsonLd)).not.toContain('openingHours')
  })
})

describe('verifiedDate', () => {
  it('keeps the Kaliningrad calendar date of an editor check', async () => {
    const { verifiedDate } = await import('../shared/schedule')
    expect(verifiedDate('2026-10-13T00:00:00Z')).toBe('2026-10-13')
    expect(verifiedDate('2026-10-12T22:30:00Z')).toBe('2026-10-13')
    expect(verifiedDate(null)).toBeNull()
  })
})

describe('eat-nearby card helpers', () => {
  it('estimates walking minutes with a street detour', async () => {
    const { formatWalk, walkMinutes } = await import('@k39/database')
    expect(walkMinutes(0.31)).toBe(5)
    expect(formatWalk(0.31)).toBe('~5 мин пешком')
    expect(formatWalk(0.01)).toBe('~1 мин пешком')
    expect(formatWalk(3)).toBe('')
  })

  it('labels known cuisines in Russian and drops unknown tokens', async () => {
    const { cuisineLabels } = await import('@k39/database')
    expect(cuisineLabels(['pizza', 'italian', 'european'])).toEqual(['пицца', 'итальянская'])
    expect(cuisineLabels(['coffee_shop', 'coffee', 'buschenschank'])).toEqual(['кофе'])
    expect(cuisineLabels([])).toEqual([])
  })
})
