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

describe('venue modules', async () => {
  const { dishMenuNode, dishPhotoProblem, dishPriceIsFresh, stampDishModules, toPublicVenueModules, venueModulesSchema } = await import('../shared/venue-modules')
  const { absoluteUrl, schemaProblems, searchBlurb, venueDocument, venueTitleBase } = await import('../shared/seo')
  it('renders only valid lists and pulls how-to-get out of the blocks', () => {
    expect(toPublicVenueModules([], (text) => text)).toBeNull()
    expect(toPublicVenueModules([{ type: 'nope' }], (text) => text)).toBeNull()
    const out = toPublicVenueModules([
      { type: 'text', text: 'Про место.' },
      { type: 'practical', items: [{ key: 'takeaway', label: 'Навынос', value: 'Да' }] },
      { type: 'how-to-get', text: 'От вокзала пять минут.' },
    ], (text) => `<p>${text}</p>`)
    expect(out?.blocks.map((block) => block.id)).toEqual(['o-meste', 'praktichno'])
    expect(out?.howToGetHtml).toBe('<p>От вокзала пять минут.</p>')
  })
  it('allows one practical module', () => {
    const item = { type: 'practical', items: [{ key: 'kids', label: 'Дети', value: 'Есть стульчики' }] }
    expect(venueModulesSchema.safeParse([item, item]).success).toBe(false)
  })
  it('caps the showcase at 8 and keeps a legacy note readable', () => {
    const item = { name: 'Смёрреброд с форелью', priceRub: 540, note: '350 г' }
    const nine = Array.from({ length: 9 }, () => item)
    expect(venueModulesSchema.safeParse([{ type: 'dishes', items: nine }]).success).toBe(false)
    expect(venueModulesSchema.safeParse([{ type: 'dishes', items: nine.slice(0, 8) }]).success).toBe(true)
    const shown = toPublicVenueModules([{ type: 'dishes', note: 'Цены из меню.', items: [item] }], (text) => text)
    const block = shown?.blocks.find((row) => row.type === 'dishes')
    expect(block?.type === 'dishes' && block.items[0]).toMatchObject({ name: 'Смёрреброд с форелью', description: '350 г', priceRub: 540 })
    expect(block?.type === 'dishes' && block.note).toBe('Цены из меню.')
  })

  it('keeps the id and hides a price older than a year', () => {
    const now = new Date('2026-10-15T12:00:00.000Z')
    const fresh = '2026-06-01T00:00:00.000Z'
    const stale = '2024-01-01T00:00:00.000Z'
    expect(dishPriceIsFresh(stale, now)).toBe(false)
    expect(dishPriceIsFresh(undefined, now)).toBe(true)
    const previous = [{
      type: 'dishes',
      items: [
        { id: 'dish-herring-01', name: 'Сельдь', description: 'С яблоком', priceRub: 480, updatedAt: stale, mediaId: 'photo-own' },
        { id: 'dish-ribs-00001', name: 'Рёбра', description: 'На двоих', priceRub: 650, updatedAt: fresh },
      ],
    }]
    const stamped = stampDishModules([{
      type: 'dishes',
      items: [
        { id: 'dish-herring-01', name: 'Сельдь', description: 'С яблоком и луком', priceRub: 480, mediaId: 'photo-own' },
        { id: 'dish-ribs-00001', name: 'Рёбра', description: 'На двоих', priceRub: 690 },
        { name: 'Блонден', note: '0,5 л', priceRub: 290 },
      ],
    }], previous, now)
    const items = stamped[0]?.type === 'dishes' ? stamped[0].items : []
    expect(items[0]).toMatchObject({ id: 'dish-herring-01', updatedAt: stale, description: 'С яблоком и луком', mediaId: 'photo-own' })
    expect(items[1]).toMatchObject({ id: 'dish-ribs-00001', priceRub: 690, updatedAt: now.toISOString() })
    expect(items[2]?.id).toBeTruthy()
    expect(items[2]).toMatchObject({ description: '0,5 л', priceRub: 290, updatedAt: now.toISOString() })
    const confirmed = stampDishModules([{
      type: 'dishes',
      items: [{ id: 'dish-herring-01', name: 'Сельдь', description: 'С яблоком', priceRub: 480, refreshPrice: true }],
    }], previous, now)
    expect(confirmed[0]?.type === 'dishes' && confirmed[0].items[0]?.updatedAt).toBe(now.toISOString())
    const view = toPublicVenueModules(previous, (text) => text, [], { now })
    const dishes = view?.blocks.find((row) => row.type === 'dishes')
    expect(dishes?.type === 'dishes' && dishes.items.map((row) => row.priceRub)).toEqual([null, 650])
    const gallery = [
      { mediaId: 'photo-own', origin: 'own' },
      { mediaId: 'photo-venue', origin: 'venue' },
    ]
    const links = [
      { id: 'dish-herring-01', mediaId: 'photo-own' },
      { id: 'new-dish-00000001', mediaId: 'photo-venue' },
    ]
    expect(dishPhotoProblem(links, [{ id: 'dish-herring-01', mediaId: 'photo-own' }], gallery, 'editorial')).toBeTruthy()
    expect(dishPhotoProblem([{ id: 'dish-herring-01', mediaId: 'photo-own' }], [{ id: 'dish-herring-01', mediaId: 'photo-own' }], gallery, 'editorial')).toBeNull()
    expect(dishPhotoProblem([{ id: 'new-dish-00000001', mediaId: 'photo-commons' }], [], [{ mediaId: 'photo-commons', origin: 'commons' }], 'editorial')).toBeNull()
    expect(dishPhotoProblem([{ id: 'new-dish-00000001', mediaId: 'photo-venue' }], [], gallery, 'owner')).toBeNull()
    expect(dishPhotoProblem([{ id: 'new-dish-00000001', mediaId: 'photo-own' }], [], gallery, 'owner')).toBeTruthy()
  })

  it('adds a Menu of the dishes that are still shown', () => {
    const doc = venueDocument({
      slug: 'bochka-pab-svetlogorsk',
      name: 'Бочка Паб',
      kind: 'bar',
      description: 'Паб со своей пивоварней на улице Ленина. '.repeat(12),
      menuUrl: 'https://bochka.example/menu',
    })
    const business = doc.jsonLd.find((node) => node['@type'] === 'BarOrPub')!
    const menu = dishMenuNode({
      title: 'Что заказать',
      items: [
        { id: 'a', name: 'Сельдь', description: 'С яблоком', priceRub: 480, media: null },
        { id: 'b', name: 'Рёбра', description: null, priceRub: null, media: { src: '/media/ribs/960.webp' } as never },
      ],
    }, { menuUrl: 'https://bochka.example/menu', absolute: absoluteUrl })
    business.hasMenu = menu
    expect(schemaProblems(doc.jsonLd)).toEqual([])
    expect(JSON.stringify(menu)).toContain('MenuItem')
    expect(JSON.stringify(menu)).toContain('https://bochka.example/menu')
    expect(JSON.stringify(menu)).toContain('https://k39.online/media/ribs/960.webp')
    expect(JSON.stringify(menu)).not.toContain('Рёбра","offers')
  })

  it('cuts snippets at a sentence and builds the title base', () => {
    const long = `${'Первое предложение про пиццерию на проспекте у моря. '.repeat(2)}А выпечку и десерты делают сами каждый день с утра до вечера.`
    expect(searchBlurb(long).endsWith('.')).toBe(true)
    expect(venueTitleBase('Сковородка', 'ресторан', 'в Зеленоградске')).toBe('Сковородка, ресторан в Зеленоградске')
  })
})
