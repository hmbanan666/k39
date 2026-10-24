import { beforeEach, expect, it, vi } from 'vitest'
import VenuePage from '../app/components/VenuePage.vue'
import { loadVenuePath } from '../server/utils/venues/public'
import { renderPage } from './helpers/render-page'

const { listRegions, bySlug, freshForVenue, freshPublished } = vi.hoisted(() => ({ listRegions: vi.fn(), bySlug: vi.fn(), freshForVenue: vi.fn(), freshPublished: vi.fn() }))
vi.mock('@k39/database', async (original) => ({
  ...await original<object>(),
  db: {
    editor: { listRegions },
    venues: { bySlug, gallery: async () => [], sponsoredIds: async () => new Set() },
    prices: { freshForVenue, freshPublished },
    content: { coversFor: async () => new Map() },
  },
}))
vi.mock('../server/utils/facts/read', async (original) => ({
  ...await original<object>(),
  readShownFacts: async () => new Map([['venue', { address: 'Посёлок, улица, 1', phone: null, latitude: null, longitude: null, status: 'open' }]]),
}))
vi.mock('../server/utils/guests/moderate', () => ({ loadGuestItems: async () => [], attachGuestReviews: () => {} }))
vi.mock('../server/utils/notices/read', () => ({ loadPublicNotices: async () => new Map(), sourcesWithNotices: (sources: unknown) => sources }))
vi.mock('../server/utils/schedule', () => ({ loadSchedule: async () => null }))
vi.mock('../server/utils/practical/public', () => ({
  loadAdmission: async () => ({ stored: false, rows: [], lines: [], extrasStored: false, extras: [], extraLines: [] }),
  loadSubjectEvents: async () => ({ rows: [], lines: [] }),
}))
vi.mock('../server/utils/venues/menu-prices', () => ({ projectMenuPrices: async (rows: unknown[]) => rows.map((row) => ({ row, comparable: true })) }))

beforeEach(() => vi.clearAllMocks())

it.each([
  { region: { id: 'area', slug: 'zelenogradsk', title: 'Историческое название', shortTitle: 'Побережье' }, label: 'Территория «Побережье»', of: 'территории «Побережье»', by: 'территории «Побережье»', where: 'На территории «Побережье»' },
  { region: { id: 'area', slug: 'zelenogradsk', title: 'Историческое название', shortTitle: 'Зеленоградск' }, label: 'Зеленоградск и окрестности', of: 'Зеленоградска и окрестностей', by: 'Зеленоградску и окрестностям', where: 'В Зеленоградске и окрестностях' },
  { region: { id: 'area', slug: 'unknown-area', title: 'Побережье', shortTitle: null }, label: 'Территория «Побережье»', of: 'территории «Побережье»', by: 'территории «Побережье»', where: 'На территории «Побережье»' },
  { region: null, label: '', of: 'этой территории', by: 'этой территории', where: 'На этой территории' },
])('keeps the selected area in every reader/SSR comparison ($label)', async ({ region, label, of, by, where }) => {
  const venue = { id: 'venue', slug: 'fixture-area-venue', name: 'Фикстура', kind: 'cafe', status: 'published', regionId: region?.id ?? null, priceBand: 'low', modules: [{ type: 'prices' }], description: 'Синтетическое описание. '.repeat(20), cuisineTags: [], sources: [], latitude: null, longitude: null }
  const own = { item: 'cappuccino', title: 'Капучино', category: 'coffee', variant: '300 мл', priceRub: 100, checkedAt: '2026-10-24', sourceTitle: 'Меню', sourceUrl: 'https://fixture.k39.test/menu' }
  listRegions.mockResolvedValue(region ? [region] : [])
  bySlug.mockResolvedValue(venue)
  freshForVenue.mockResolvedValue([own])
  freshPublished.mockResolvedValue([200, 300].map((priceRub, index) => ({ ...own, venueId: `peer-${index}`, regionId: venue.regionId, priceRub })))
  const page = await loadVenuePath('/zavedeniya/fixture-area-venue')
  if (page?.type !== 'venue') {
    throw new Error('Expected venue reader output')
  }
  const block = page.venue.modules?.blocks.find((entry) => entry.type === 'prices')
  if (block?.type !== 'prices') {
    throw new Error('Expected prices block')
  }
  expect(page.venue.regionTitle).toBe(label || null)
  expect(block.lead).toBe(`Сравниваем с другими заведениями ${of}`)
  expect(block.summary?.label).toBe(`Цены ниже среднего по ${by}`)
  expect(block.items[0]?.comparison).toMatchObject({
    line: `Дешевле, чем в 2 из 3 мест ${of}`, scaleLabel: `Дешевле медианы по ${by}`,
    town: { places: 3, medianRub: 200, where },
  })
  expect(block.items[0]?.href).toBe(`/ceny/cappuccino${region ? `/${region.slug}` : ''}?from=fixture-area-venue`)
  expect(listRegions).toHaveBeenCalledTimes(region ? 2 : 1)
  expect(freshPublished).toHaveBeenCalledTimes(1)
  const html = await renderPage(VenuePage, { page })
  expect(html).toContain(block.lead)
  expect(html).toContain(`aria-label="Цены ниже среднего по ${by}"`)
  expect(html).toContain(`aria-label="Дешевле медианы по ${by}"`)
  expect(html).toContain(where)
  if (label) {
    expect(page.doc.crumbs[2]?.name).toBe(label)
  }
  if (region?.shortTitle === 'Побережье') {
    expect(page.doc.title).toContain('на территории «Побережье»')
    expect(html).not.toContain('Зеленоградск и окрестности')
  }
})
