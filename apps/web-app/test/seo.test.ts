import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import seed from '../../../packages/database/src/seed/initial-content.json'
import { findOrphans, haversineKm, homeLinks, HUBS, SECTION_LINKS } from '../shared/links'
import { renderMarkdown } from '../shared/markdown'
import { decideRedirect } from '../shared/redirects'
import { collectionDocument, countH1, homeDocument, pageTitle, placeDocument, placeSchemaType, tuneRobots, verificationMeta } from '../shared/seo'

function assertDocument(doc: ReturnType<typeof homeDocument>, htmlBody: string) {
  expect(doc.title.length).toBeGreaterThan(10)
  expect(doc.description.length).toBeGreaterThan(20)
  expect(doc.canonical.startsWith('https://k39.online')).toBe(true)
  expect(doc.canonical.includes('?')).toBe(false)
  expect(countH1(`<h1>${doc.h1}</h1>${htmlBody}`)).toBe(1)
  expect(doc.jsonLd.length).toBeGreaterThan(0)
  for (const node of doc.jsonLd) {
    expect(node['@type']).toBeTruthy()
  }
}

describe('seo documents', () => {
  it('covers home, place, hub, route, collection and quest', () => {
    const home = homeDocument()
    assertDocument(home, '')
    expect(home.jsonLd.map((node) => node['@type'])).toEqual(['Organization', 'WebSite'])

    const place = placeDocument({
      slug: 'fort-11-denhoff',
      title: 'Форт № 11 «Дёнхофф»',
      summary: 'Частный музей на юго-востоке Калининграда, в кольце фортов.',
      categorySlug: 'forty',
      categoryTitle: 'Форты',
      regionTitle: 'Калининград',
      latitude: 54.65,
      longitude: 20.56,
      hours: '10:00-18:00',
      sources: [{ title: 'Википедия', url: 'https://ru.wikipedia.org/wiki/fort' }],
    })
    assertDocument(place, renderMarkdown('## Как добраться\n\nАвтобусом до остановки.'))
    expect(place.h1).toBe('Форт № 11 «Дёнхофф»')
    expect(place.title).toContain('Форт № 11')
    expect(placeSchemaType('forty')).toBe('LandmarksOrHistoricalBuildings')
    expect(placeSchemaType('plyazhi')).toBe('Beach')
    expect(placeSchemaType('muzei')).toBe('Museum')
    const attraction = place.jsonLd.find((node) => node['@type'] === 'LandmarksOrHistoricalBuildings')
    expect(attraction?.geo).toMatchObject({ latitude: 54.65, longitude: 20.56 })

    const hub = collectionDocument({
      path: '/forty',
      h1: 'Форты',
      summary: 'Форты, ворота и бастионы Кёнигсберга со статусом и часами работы.',
      crumbName: 'раздел',
      items: [{ name: 'Форт № 11 «Дёнхофф»', url: '/fort-11-denhoff' }],
      kind: 'CollectionPage',
    })
    assertDocument(hub, '')
    expect(hub.jsonLd.some((node) => node['@type'] === 'CollectionPage')).toBe(true)
    expect(hub.jsonLd.some((node) => node['@type'] === 'BreadcrumbList')).toBe(true)

    const route = collectionDocument({
      path: '/marshruty/pyat-fortov',
      h1: 'Пять фортов за один выезд',
      summary: 'Редакционный маршрут по фортам, куда по источникам можно попасть.',
      crumbName: 'маршрут',
      parent: { name: 'Маршруты', href: '/marshruty' },
      items: [{ name: 'Форт № 11 «Дёнхофф»', url: '/fort-11-denhoff' }],
      kind: 'TouristTrip',
    })
    assertDocument(route, '')
    expect(route.jsonLd.some((node) => node['@type'] === 'TouristTrip')).toBe(true)

    const quest = collectionDocument({
      path: '/kvesty/pyat-fortov',
      h1: 'Квест: 5 фортов',
      summary: 'Пять фортов, куда по источникам можно попасть, с порядком точек.',
      crumbName: 'квест',
      parent: { name: 'Квесты', href: '/kvesty' },
      items: [{ name: 'Форт № 5', url: '/fort-5-korol-fridrih-vilgelm-iii' }],
      kind: 'TouristTrip',
    })
    assertDocument(quest, '')

    const draft = placeDocument({
      slug: 'hidden',
      title: 'Черновик',
      summary: 'Этот текст не должен попасть в индекс поисковой системы.',
      categorySlug: 'eda',
      categoryTitle: 'Еда',
      regionTitle: null,
      latitude: null,
      longitude: null,
      hours: null,
      sources: [],
      noindex: true,
    })
    expect(draft.robots).toContain('noindex')
    expect(pageTitle('Имя', 'контекст')).toContain('| K39')
    expect(place.jsonLd.some((node) => node['@type'] === 'BreadcrumbList')).toBe(true)
    expect(place.jsonLd.some((node) => node['@type'] === 'FAQPage')).toBe(false)
    const geo = (attraction?.geo ?? {}) as { '@type'?: string }
    expect(geo['@type']).toBe('GeoCoordinates')
    const paged = placeDocument({ ...placeInput(), page: 2 })
    expect(paged.robots).toContain('noindex')
    expect(paged.canonical).toBe('https://k39.online/fort-11-denhoff?page=2')
    const filtered = tuneRobots(place, { q: 'fort' })
    expect(filtered.robots).toContain('noindex')
    expect(filtered.canonical).toBe(place.canonical)
    expect(tuneRobots(place, { utm_source: 'ya' }).robots).toBe(place.robots)
  })
})

function placeInput() {
  return {
    slug: 'fort-11-denhoff',
    title: 'Форт № 11 «Дёнхофф»',
    summary: 'Частный музей на юго-востоке Калининграда, в кольце фортов.',
    categorySlug: 'forty',
    categoryTitle: 'Форты',
    regionTitle: 'Калининград',
    latitude: 54.65,
    longitude: 20.56,
    hours: '10:00-18:00',
    sources: [{ title: 'Википедия', url: 'https://ru.wikipedia.org/wiki/fort' }],
  }
}

describe('redirects', () => {
  it('resolves host, old paths and slug redirects in one hop', () => {
    const moved = decideRedirect({
      hostHeader: 'www.k39.online',
      protoHeader: 'http',
      path: '/place/fort-old/',
      search: '?utm_source=ya',
      redirects: [{ fromPath: '/fort-old', toPath: '/fort-new', statusCode: 301 }],
    })
    expect(moved).toEqual({ kind: 'redirect', location: 'https://k39.online/fort-new?utm_source=ya' })

    const quest = decideRedirect({
      hostHeader: 'k39.online',
      protoHeader: 'https',
      path: '/quest/five-forts',
    })
    expect(quest).toEqual({ kind: 'redirect', location: 'https://k39.online/kvesty/pyat-fortov' })

    const map = decideRedirect({
      hostHeader: 'k39.online',
      protoHeader: 'https',
      path: '/map/kaliningrad',
      mapEnabled: false,
    })
    expect(map).toEqual({ kind: 'redirect', location: 'https://k39.online/forty' })

    const gone = decideRedirect({
      hostHeader: 'k39.online',
      protoHeader: 'https',
      path: '/gone-place',
      redirects: [{ fromPath: '/gone-place', toPath: null, statusCode: 410 }],
    })
    expect(gone.kind).toBe('gone')

    expect(decideRedirect({ hostHeader: 'localhost:3000', path: '/' }).kind).toBe('none')
    expect(decideRedirect({
      hostHeader: 'localhost:3000',
      path: '/place/fort-11-denhoff',
    })).toEqual({ kind: 'redirect', location: 'http://localhost:3000/fort-11-denhoff' })

    const chain = decideRedirect({
      hostHeader: 'k39.online',
      protoHeader: 'https',
      path: '/a',
      redirects: [
        { fromPath: '/a', toPath: '/b', statusCode: 301 },
        { fromPath: '/b', toPath: '/c', statusCode: 301 },
      ],
    })
    expect(chain).toEqual({ kind: 'redirect', location: 'https://k39.online/c' })
  })
})

describe('verification meta', () => {
  it('omits empty search-console tokens', () => {
    expect(verificationMeta('', '')).toEqual([])
    expect(verificationMeta('   ', undefined)).toEqual([])
    expect(verificationMeta('ya-token', '')).toEqual([{ name: 'yandex-verification', content: 'ya-token' }])
    expect(verificationMeta(null, 'google-token')).toEqual([{ name: 'google-site-verification', content: 'google-token' }])
  })
})

describe('robots.txt', () => {
  it('points Yandex at the apex sitemap and hides private paths', () => {
    const text = readFileSync(resolve(process.cwd(), 'apps/web-app/public/robots.txt'), 'utf8')
    expect(text).toContain('Host: k39.online')
    expect(text).toContain('Clean-param: utm_source')
    expect(text).toContain('Sitemap: https://k39.online/sitemap.xml')
    expect(text).toContain('Disallow: /admin')
    expect(text).toContain('Disallow: /preview')
    expect(text).toContain('Disallow: /api')
  })
})

describe('sitemap and orphans', () => {
  it('keeps drafts out and gives every seeded page an inbound link', () => {
    const rows = [
      { published: true, noindex: false, loc: '/fort-11-denhoff' },
      { published: false, noindex: false, loc: '/draft-place' },
      { published: true, noindex: true, loc: '/secret' },
    ]
    const locs = rows.filter((row) => row.published && !row.noindex).map((row) => row.loc)
    expect(locs).toEqual(['/fort-11-denhoff'])

    const places = seed.places
    const nearestOf = (slug: string) => {
      const origin = places.find((item) => item.slug === slug)
      if (!origin) {
        return []
      }
      return places
        .filter((item) => item.slug !== slug)
        .map((item) => ({
          slug: item.slug,
          title: item.title,
          distance: haversineKm(origin.latitude, origin.longitude, item.latitude, item.longitude),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5)
    }
    const pages = [
      { path: '/', outbound: homeLinks(places.slice(0, 6).map((item) => ({ href: `/${item.slug}`, text: item.title }))) },
      ...HUBS.map((hub) => ({
        path: hub.href,
        outbound: places.filter((item) => `/${item.categorySlug}` === hub.href).map((item) => ({ href: `/${item.slug}`, text: item.title })),
      })),
      ...SECTION_LINKS.map((link) => ({ path: link.href, outbound: [] as { href: string, text: string }[] })),
      { path: '/legal/privacy-policy', outbound: [] },
      { path: `/marshruty/${seed.route.slug}`, outbound: seed.route.placeSlugs.map((slug) => ({ href: `/${slug}`, text: slug })) },
      { path: `/podborki/${seed.collection.slug}`, outbound: seed.collection.placeSlugs.map((slug) => ({ href: `/${slug}`, text: slug })) },
      { path: `/kvesty/${seed.quest.slug}`, outbound: seed.quest.placeSlugs.map((slug) => ({ href: `/${slug}`, text: slug })) },
      ...places.map((place) => ({
        path: `/${place.slug}`,
        outbound: [
          { href: `/${place.categorySlug}`, text: place.categorySlug },
          ...nearestOf(place.slug).map((item) => ({ href: `/${item.slug}`, text: item.title })),
          ...(seed.route.placeSlugs.includes(place.slug) ? [{ href: `/marshruty/${seed.route.slug}`, text: seed.route.title }] : []),
          ...(seed.collection.placeSlugs.includes(place.slug) ? [{ href: `/podborki/${seed.collection.slug}`, text: seed.collection.title }] : []),
        ],
      })),
    ]
    pages.find((page) => page.path === '/marshruty')?.outbound.push({ href: `/marshruty/${seed.route.slug}`, text: seed.route.title })
    pages.find((page) => page.path === '/podborki')?.outbound.push({ href: `/podborki/${seed.collection.slug}`, text: seed.collection.title })
    pages.find((page) => page.path === '/kvesty')?.outbound.push({ href: `/kvesty/${seed.quest.slug}`, text: seed.quest.title })
    expect(findOrphans(pages)).toEqual([])
  })
})
