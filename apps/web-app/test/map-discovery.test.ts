import type { H3Event } from 'h3'
import { describe, expect, it, vi } from 'vitest'
import SiteFooter from '../app/components/SiteFooter.vue'
import sitemapHandler from '../server/routes/sitemap-urls.get'
import { loadMap } from '../server/utils/map/public'
import { headFromDocument, tuneRobots } from '../shared/seo'
import { renderPage } from './helpers/render-page'

vi.mock('@k39/database', async (original) => ({
  ...await original<object>(),
  isDatabaseReady: () => true,
  db: {
    content: {
      sitemapRows: async () => ({ places: [], routes: [], collections: [], quests: [], venues: [], venueListings: [] }),
      categories: async () => [],
      mapPlaces: async () => [],
      mapRouteStops: async () => [],
      coversFor: async () => new Map(),
    },
    venues: {
      list: async () => [],
      coversFor: async () => new Map(),
      sponsoredIds: async () => new Set(),
    },
    schedules: { forEntities: async () => [] },
  },
}))
vi.mock('../server/utils/venues/public', () => ({ loadEatNow: async () => null, sponsoredVenuesEnabled: () => false }))
vi.mock('../server/utils/venues/price-page', () => ({ priceSitemapEntries: async () => [] }))

describe('map discovery', () => {
  it('adds the clean map URL exactly once to the real sitemap source', async () => {
    const entries = await sitemapHandler({} as H3Event)
    expect(entries.filter((entry) => entry.loc === 'https://k39.online/map')).toHaveLength(1)
    expect(entries.filter((entry) => entry.loc.startsWith('https://k39.online/map?'))).toEqual([])
    expect(entries.filter((entry) => entry.loc.startsWith('https://k39.online/map/'))).toEqual([])
  })

  it('renders exactly one map footer link', async () => {
    const html = await renderPage(SiteFooter, {})
    expect(html.match(/href="\/map"/g)).toHaveLength(1)
    expect(html).toContain('Карта')
  })

  it('uses the intended title in the loader and head without repeating the region', async () => {
    const { doc } = await loadMap()
    const head = headFromDocument(doc)
    expect(doc.title).toBe('Карта Калининградской области | K39')
    expect(head.title).toBe(doc.title)
    expect(head.meta.find((meta) => 'property' in meta && meta.property === 'og:title')?.content).toBe(doc.title)
    expect(doc.canonical).toBe('https://k39.online/map')
    expect(doc.robots).not.toContain('noindex')
  })

  it.each([
    { c: 'sights' }, { s: 'forty' }, { f: 'kofe' }, { r: 'five-forts' },
    { q: 'Форт' }, { focus: 'fort-11-denhoff' },
  ])('keeps a filtered map noindex with a clean canonical: %j', async (query) => {
    const { doc } = await loadMap()
    const filtered = tuneRobots(doc, query)
    expect(filtered.robots).toContain('noindex')
    expect(filtered.canonical).toBe('https://k39.online/map')
    expect(filtered.title).toBe('Карта Калининградской области | K39')
  })

  it('keeps tracking-only map links indexable', async () => {
    const { doc } = await loadMap()
    const tracked = tuneRobots(doc, { utm_source: 'review', yclid: '123' })
    expect(tracked.robots).not.toContain('noindex')
    expect(tracked.canonical).toBe('https://k39.online/map')
  })
})
