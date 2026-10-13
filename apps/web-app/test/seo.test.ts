import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHead, renderSSRHead } from 'unhead/server'
import { describe, expect, it } from 'vitest'
import seed from '../../../packages/database/src/seed/initial-content.json'
import { findOrphans, haversineKm, homeLinks, HUBS, indexableHubs, SECTION_LINKS } from '../shared/links'
import { renderMarkdown } from '../shared/markdown'
import { lcpPreload, openGraphFile } from '../shared/media'
import { decideRedirect } from '../shared/redirects'
import { accessibleForFree, brandHeadLinks, collectionDocument, countH1, headFromDocument, homeDocument, imageCredit, jsonLdTypes, pageTitle, placeDocument, placeNodeTypes, placeSchemaType, schemaOpeningHours, schemaProblems, tuneRobots, venueDocument, venueSchemaType, verificationMeta } from '../shared/seo'

function assertDocument(doc: ReturnType<typeof homeDocument>, htmlBody: string) {
  expect(doc.title.length).toBeGreaterThan(10)
  expect(doc.description.length).toBeGreaterThan(20)
  expect(doc.canonical.startsWith('https://k39.online')).toBe(true)
  expect(doc.canonical.includes('?')).toBe(false)
  expect(countH1(`<h1>${doc.h1}</h1>${htmlBody}`)).toBe(1)
  expect(doc.jsonLd.length).toBeGreaterThan(0)
  for (const node of doc.jsonLd) {
    expect(jsonLdTypes(node).length).toBeGreaterThan(0)
  }
  expect(schemaProblems(doc.jsonLd)).toEqual([])
  expect(doc.title.length).toBeGreaterThanOrEqual(15)
  expect(doc.title.length).toBeLessThanOrEqual(70)
  expect(doc.description.length).toBeGreaterThanOrEqual(50)
  expect(doc.description.length).toBeLessThanOrEqual(170)
  expect(doc.robots).toContain('max-image-preview:large')
  expect(doc.title).not.toContain('—')
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
    expect(placeSchemaType('zamki')).toBe('LandmarksOrHistoricalBuildings')
    expect(placeSchemaType('plyazhi')).toBe('Beach')
    expect(placeSchemaType('muzei')).toBe('Museum')
    expect(placeNodeTypes('forty')).toEqual(['TouristAttraction', 'LandmarksOrHistoricalBuildings'])
    expect(placeNodeTypes('plyazhi')).toEqual(['TouristAttraction', 'Beach'])
    expect(placeNodeTypes('muzei')).toEqual(['TouristAttraction', 'Museum'])
    expect(placeNodeTypes('zamki')).toEqual(['TouristAttraction', 'LandmarksOrHistoricalBuildings'])
    expect(placeNodeTypes('kurorty')).toBe('TouristAttraction')
    const attraction = place.jsonLd.find((node) => jsonLdTypes(node).includes('LandmarksOrHistoricalBuildings'))
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
    expect(route.jsonLd.some((node) => node['@type'] === 'FAQPage')).toBe(false)

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
    expect(pageTitle('Имя')).toBe('Имя | K39')
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

  it('adds the same FAQPage to a route and a collection when the body has Частые вопросы', () => {
    const body = [
      '## Частые вопросы',
      '',
      '**Сколько занимает?** Один день.',
      '',
      '## Дальше',
      '',
      '**Не вопрос** и не попадает в FAQ.',
    ].join('\n')
    const place = placeDocument({ ...placeInput(), body })
    const route = collectionDocument({
      path: '/marshruty/pyat-fortov',
      h1: 'Пять фортов за один выезд',
      summary: 'Редакционный маршрут по фортам.',
      crumbName: 'маршрут',
      parent: { name: 'Маршруты', href: '/marshruty' },
      items: [{ name: 'Форт № 11 «Дёнхофф»', url: '/fort-11-denhoff', note: 'С экскурсией' }],
      kind: 'TouristTrip',
      body,
    })
    const collection = collectionDocument({
      path: '/podborki/otkrytye-forty',
      h1: 'Открытые форты',
      summary: 'Форты, куда по источникам можно попасть.',
      crumbName: 'подборка',
      parent: { name: 'Подборки', href: '/podborki' },
      items: [{ name: 'Форт № 11 «Дёнхофф»', url: '/fort-11-denhoff' }],
      kind: 'CollectionPage',
      body,
    })
    const placeFaq = place.jsonLd.find((node) => node['@type'] === 'FAQPage')
    expect(placeFaq).toBeTruthy()
    expect(route.jsonLd.find((node) => node['@type'] === 'FAQPage')).toEqual(placeFaq)
    expect(collection.jsonLd.find((node) => node['@type'] === 'FAQPage')).toEqual(placeFaq)
    const trip = route.jsonLd.find((node) => node['@type'] === 'TouristTrip') as {
      itinerary?: { itemListElement?: Array<{ description?: string }> }
    }
    expect(trip.itinerary?.itemListElement?.[0]?.description).toBe('С экскурсией')
    const quiet = collectionDocument({
      path: '/podborki/bez-voprosov',
      h1: 'Без вопросов',
      summary: 'Текст без раздела вопросов, который не должен стать FAQ.',
      crumbName: 'подборка',
      items: [],
      kind: 'CollectionPage',
      body: '## Как добраться\n\nПешком.',
    })
    expect(quiet.jsonLd.some((node) => node['@type'] === 'FAQPage')).toBe(false)

    const quest = collectionDocument({
      path: '/kvesty/pyat-fortov',
      h1: 'Квест: 5 фортов',
      summary: 'Пять фортов, куда по источникам можно попасть.',
      crumbName: 'квест',
      parent: { name: 'Квесты', href: '/kvesty' },
      items: [{ name: 'Форт № 5', url: '/fort-5-korol-fridrih-vilgelm-iii' }],
      kind: 'TouristTrip',
      body,
    })
    const hub = collectionDocument({
      path: '/forty',
      h1: 'Форты',
      summary: 'Форты, ворота и бастионы Кёнигсберга.',
      crumbName: 'раздел',
      items: [{ name: 'Форт № 11 «Дёнхофф»', url: '/fort-11-denhoff' }],
      kind: 'CollectionPage',
      seoTitle: 'Форты Калининграда',
      body,
    })
    expect(quest.jsonLd.find((node) => node['@type'] === 'FAQPage')).toEqual(placeFaq)
    expect(hub.jsonLd.find((node) => node['@type'] === 'FAQPage')).toEqual(placeFaq)
    expect(hub.title).toBe('Форты Калининграда | K39')

    const hubArticle = [
      '## Частые вопросы',
      '',
      '### Какой форт выбрать, если время только на один?',
      '',
      'Форт № 5, если нужен музей с часами.',
      '',
      '### Можно ли зайти в заброшенные форты?',
      '',
      'У форта № 2а вход свободный, но без охраны.',
    ].join('\n')
    const hubFaq = collectionDocument({
      path: '/forty',
      h1: 'Форты',
      summary: 'Форты, ворота и бастионы Кёнигсберга.',
      crumbName: 'раздел',
      items: [{ name: 'Форт № 11 «Дёнхофф»', url: '/fort-11-denhoff' }],
      kind: 'CollectionPage',
      body: hubArticle,
    })
    const questions = hubFaq.jsonLd.find((node) => node['@type'] === 'FAQPage') as { mainEntity?: Array<{ name: string, acceptedAnswer?: { text: string } }> }
    expect(questions?.mainEntity?.map((item) => item.name)).toEqual([
      'Какой форт выбрать, если время только на один?',
      'Можно ли зайти в заброшенные форты?',
    ])
    expect(questions?.mainEntity?.[0]?.acceptedAnswer?.text).toContain('Форт № 5')
  })

  it('uses the title or seoTitle, a vertical bar, and no repeated type word', () => {
    expect(homeDocument().title).toBe('Куда сходить в Калининградской области | K39')
    const place = placeDocument({ ...placeInput() })
    expect(place.title).toBe('Форт № 11 «Дёнхофф»: часы и как добраться | K39')
    expect(placeDocument({ ...placeInput(), seoTitle: 'Форт Дёнхофф: часы и дорога' }).title).toBe('Форт Дёнхофф: часы и дорога | K39')
    expect(pageTitle('Форт', 'Форт Дёнхофф | K39')).toBe('Форт Дёнхофф | K39')

    const titled = [
      ['Форты', 'раздел', undefined, 'Форты: Калининградская область | K39'],
      ['Пять фортов за один выезд', 'маршрут', undefined, 'Пять фортов за один выезд: остановки по порядку | K39'],
      ['Форты, куда пускают', 'подборка', undefined, 'Форты, куда пускают: места по теме | K39'],
      ['Квест: 5 фортов', 'квест', undefined, 'Квест: 5 фортов: точки и задания | K39'],
      ['Маршруты', 'список', undefined, 'Маршруты: Калининградская область | K39'],
      ['Подборки', 'список', undefined, 'Подборки: Калининградская область | K39'],
      ['Квесты', 'список', undefined, 'Квесты: Калининградская область | K39'],
    ] as const
    for (const [h1, crumbName, seoTitle, title] of titled) {
      const doc = collectionDocument({
        path: '/example',
        h1,
        summary: 'Короткое описание страницы для поисковой выдачи.',
        crumbName,
        items: [],
        kind: 'CollectionPage',
        seoTitle,
      })
      expect(doc.title).toBe(title)
      expect(doc.title).not.toContain('—')
      expect(doc.title.endsWith('| K39')).toBe(true)
      expect(doc.title.split('| K39')).toHaveLength(2)
    }
    expect(collectionDocument({
      path: '/kvesty/pyat-fortov',
      h1: 'Квест: 5 фортов',
      summary: 'Пять фортов, куда по источникам можно попасть.',
      crumbName: 'квест',
      items: [],
      kind: 'TouristTrip',
    }).title.toLowerCase().match(/квест/g)).toEqual(['квест'])
  })

  it('lists ordered places with coordinates on a tourist trip', () => {
    const route = collectionDocument({
      path: '/marshruty/zamki-vostoka',
      h1: 'Замки востока за день: Тапиау, Инстербург, Рагнит',
      summary: 'Три орденских замка на восток от Калининграда за один день на машине.',
      crumbName: 'маршрут',
      parent: { name: 'Маршруты', href: '/marshruty' },
      kind: 'TouristTrip',
      items: [
        { name: 'Замок Тапиау', url: '/zamok-tapiau', note: 'Старт от кассы', latitude: 54.64528, longitude: 21.07472 },
        { name: 'Замок Инстербург', url: '/zamok-insterburg', latitude: 54.63972, longitude: 21.80667 },
        { name: 'Замок Рагнит', url: '/zamok-ragnit', latitude: null, longitude: null },
      ],
    })
    const trip = route.jsonLd.find((node) => node['@type'] === 'TouristTrip') as {
      itinerary?: {
        '@type'?: string
        'numberOfItems'?: number
        'itemListElement'?: Array<{
          position?: number
          description?: string
          item?: { '@type'?: string, 'url'?: string, 'geo'?: { latitude: number, longitude: number } }
        }>
      }
    }
    expect(trip.itinerary?.['@type']).toBe('ItemList')
    expect(trip.itinerary?.numberOfItems).toBe(3)
    expect(trip.itinerary?.itemListElement?.map((item) => item.position)).toEqual([1, 2, 3])
    expect(trip.itinerary?.itemListElement?.[0]?.description).toBe('Старт от кассы')
    expect(trip.itinerary?.itemListElement?.[0]?.item).toMatchObject({
      '@type': 'TouristAttraction',
      'url': 'https://k39.online/zamok-tapiau',
      'geo': { '@type': 'GeoCoordinates', 'latitude': 54.64528, 'longitude': 21.07472 },
    })
    expect(trip.itinerary?.itemListElement?.[2]?.item?.geo).toBeUndefined()
    expect(trip.itinerary?.itemListElement?.[2]?.item?.url).toBe('https://k39.online/zamok-ragnit')
    const hub = collectionDocument({
      path: '/forty',
      h1: 'Форты',
      summary: 'Форты, ворота и бастионы Кёнигсберга со статусом и часами работы.',
      crumbName: 'раздел',
      items: [{ name: 'Форт № 11 «Дёнхофф»', url: '/fort-11-denhoff', latitude: 54.65, longitude: 20.56 }],
      kind: 'CollectionPage',
    })
    const page = hub.jsonLd.find((node) => node['@type'] === 'CollectionPage') as { mainEntity?: { itemListElement?: Array<{ item?: unknown }> } }
    expect(page.mainEntity?.itemListElement?.[0]?.item).toBeUndefined()
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

describe('image credit', () => {
  const commons = {
    url: 'https://k39.online/media/photo/og.jpg',
    width: 1200,
    height: 800,
    alt: 'Форт',
    author: 'Irina Yakubovskaya',
    license: 'cc-by',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fort.jpg',
  }

  function imagesOf(nodes: Array<Record<string, unknown>>) {
    return nodes.flatMap((node) => {
      const image = node.image
      if (!image || typeof image === 'string') {
        return []
      }
      return (Array.isArray(image) ? image : [image]) as Array<Record<string, unknown>>
    })
  }

  it('adds creditText and copyrightNotice on place, route, venue, and collection images', () => {
    expect(imageCredit({ author: 'Irina Yakubovskaya', license: 'cc-by' })).toEqual({
      creditText: 'Irina Yakubovskaya, CC BY 4.0',
      copyrightNotice: '© Irina Yakubovskaya',
    })
    expect(imageCredit({ author: 'Irina Yakubovskaya', license: 'pd' })).toEqual({
      creditText: 'Irina Yakubovskaya',
    })
    expect(imageCredit({ license: 'cc0' })).toEqual({ creditText: 'Wikimedia Commons' })
    expect(imageCredit({ license: 'pd' })).toEqual({ creditText: 'Wikimedia Commons' })
    expect(imageCredit({})).toBeNull()

    const place = imagesOf(placeDocument({ ...placeInput(), images: [commons] }).jsonLd)[0]
    expect(place?.['@type']).toBe('ImageObject')
    expect(place?.creditText).toBe('Irina Yakubovskaya, CC BY 4.0')
    expect(place?.copyrightNotice).toBe('© Irina Yakubovskaya')

    const publicDomain = imagesOf(placeDocument({
      ...placeInput(),
      images: [{ ...commons, author: null, license: 'pd' }],
    }).jsonLd)[0]
    expect(publicDomain?.creditText).toBe('Wikimedia Commons')
    expect(publicDomain).not.toHaveProperty('copyrightNotice')

    const venue = imagesOf(venueDocument({
      slug: 'kofeynya-u-forta',
      name: 'Кофейня у форта',
      kind: 'coffee',
      description: 'Кофейня у форта варит эспрессо и кормит обедом. '.repeat(8),
      image: commons,
    }).jsonLd)[0]
    expect(venue?.creditText).toBe('Irina Yakubovskaya, CC BY 4.0')
    expect(venue?.copyrightNotice).toBe('© Irina Yakubovskaya')

    const route = imagesOf(collectionDocument({
      path: '/marshruty/koltso-fortov',
      h1: 'Кольцо фортов',
      summary: 'Маршрут по фортам.',
      items: [],
      kind: 'TouristTrip',
      images: [{ ...commons, license: 'cc0' }],
    }).jsonLd)[0]
    expect(route?.creditText).toBe('Irina Yakubovskaya')
    expect(route).not.toHaveProperty('copyrightNotice')

    const collection = imagesOf(collectionDocument({
      path: '/podborki/forty',
      h1: 'Форты',
      summary: 'Подборка фортов.',
      items: [],
      kind: 'CollectionPage',
      images: [commons],
    }).jsonLd)[0]
    expect(collection?.creditText).toBe('Irina Yakubovskaya, CC BY 4.0')
    expect(collection?.copyrightNotice).toBe('© Irina Yakubovskaya')
  })
})

describe('schema facts', () => {
  it('emits opening hours and free admission only from unambiguous facts', () => {
    expect(schemaOpeningHours('Ежедневно 10:00-18:00')).toBe('Mo-Su 10:00-18:00')
    expect(schemaOpeningHours('пн-пт 9:00-17:00')).toBe('Mo-Fr 09:00-17:00')
    expect(schemaOpeningHours('сб 10:00-16:00')).toBe('Sa 10:00-16:00')
    expect(schemaOpeningHours('10:00-18:00')).toBeNull()
    expect(schemaOpeningHours('10:00-19:00, касса до 18:00, без выходных')).toBeNull()
    expect(schemaOpeningHours('Ежедневно. С 1 июня касса 10:00-18:00')).toBeNull()
    expect(accessibleForFree('бесплатно')).toBe(true)
    expect(accessibleForFree('0 ₽')).toBe(true)
    expect(accessibleForFree('600 ₽')).toBe(false)
    expect(accessibleForFree('уточняйте')).toBeNull()
    expect(accessibleForFree('бесплатно по выходным, 300 ₽')).toBeNull()
    expect(accessibleForFree(null)).toBeNull()

    const daily = placeDocument({
      ...placeInput(),
      hours: 'Ежедневно 10:00-18:00',
      price: 'бесплатно',
    })
    const node = daily.jsonLd.find((item) => jsonLdTypes(item).includes('TouristAttraction')) as {
      openingHours?: string
      isAccessibleForFree?: boolean
    }
    expect(node.openingHours).toBe('Mo-Su 10:00-18:00')
    expect(node.isAccessibleForFree).toBe(true)
    expect(schemaProblems(daily.jsonLd)).toEqual([])

    const vague = placeDocument({ ...placeInput(), hours: '10:00-18:00', price: 'уточняйте' })
    const vagueNode = vague.jsonLd.find((item) => jsonLdTypes(item).includes('TouristAttraction')) as Record<string, unknown>
    expect(vagueNode.openingHours).toBeUndefined()
    expect(vagueNode.isAccessibleForFree).toBeUndefined()
    expect(JSON.stringify(vagueNode)).not.toContain('Castle')

    const paid = placeDocument({ ...placeInput(), categorySlug: 'muzei', categoryTitle: 'Музеи', price: '500 ₽' })
    expect(jsonLdTypes(paid.jsonLd.find((item) => jsonLdTypes(item).includes('Museum')) || {})).toEqual(['TouristAttraction', 'Museum'])
    expect((paid.jsonLd.find((item) => jsonLdTypes(item).includes('Museum')) as { isAccessibleForFree?: boolean }).isAccessibleForFree).toBe(false)

    const beach = placeDocument({ ...placeInput(), categorySlug: 'plyazhi', categoryTitle: 'Пляжи', hours: null, price: null })
    expect(jsonLdTypes(beach.jsonLd.find((item) => jsonLdTypes(item).includes('Beach')) || {})).toEqual(['TouristAttraction', 'Beach'])

    const cafe = venueDocument({
      slug: 'kofe',
      name: 'Кофейня у форта',
      kind: 'coffee',
      description: 'Кофейня у форта варит эспрессо и кормит обедом после экскурсии. '.repeat(3),
      priceLevel: 2,
      cuisine: ['coffee', ''],
      hours: [{ weekday: 'mon', opens: '09:00', closes: '18:00' }],
    })
    expect(venueSchemaType('coffee')).toBe('CafeOrCoffeeShop')
    expect(cafe.jsonLd.map((item) => item['@type'])).toEqual(['BreadcrumbList', 'CafeOrCoffeeShop'])
    expect(JSON.stringify(cafe.jsonLd)).toContain('priceRange')
    expect(JSON.stringify(cafe.jsonLd)).toContain('coffee')
    expect(JSON.stringify(cafe.jsonLd)).not.toContain('""')
    const closed = venueDocument({
      slug: 'bez-chasov',
      name: 'Без часов',
      kind: 'cafe',
      description: 'Кафе без расписания на карточке. '.repeat(4),
      hours: [
        { weekday: 'mon', closed: true, opens: null, closes: null },
        { weekday: 'tue', closed: true, opens: null, closes: null },
      ],
    })
    expect(JSON.stringify(closed.jsonLd)).not.toContain('openingHours')
    expect(schemaProblems(cafe.jsonLd)).toEqual([])
    expect(schemaProblems(closed.jsonLd)).toEqual([])
  })

  it('preloads the hero AVIF and reports the og.jpg box', () => {
    const media = {
      id: 'photo',
      alt: 'Форт',
      caption: null,
      author: null,
      license: null,
      sourceUrl: null,
      width: 2560,
      height: 1440,
      focalX: 0.5,
      focalY: 0.5,
      dominantColor: null,
      lqip: null,
      src: '/media/photo/master.webp',
      variants: [
        { format: 'webp' as const, width: 2560, height: 1440, bytes: 10, file: 'master.webp' },
        { format: 'avif' as const, width: 640, height: 360, bytes: 4, file: '640.avif' },
        { format: 'webp' as const, width: 640, height: 360, bytes: 5, file: '640.webp' },
        { format: 'jpeg' as const, width: 1200, height: 630, bytes: 8, file: 'og.jpg' },
      ],
    }
    expect(openGraphFile(media)).toMatchObject({
      path: '/media/photo/og.jpg',
      width: 1200,
      height: 630,
      type: 'image/jpeg',
    })
    const preload = lcpPreload(media, '(min-width: 1000px) 720px, 100vw')
    expect(preload).toMatchObject({
      rel: 'preload',
      as: 'image',
      type: 'image/avif',
      fetchpriority: 'high',
      imagesizes: '(min-width: 1000px) 720px, 100vw',
    })
    expect(preload?.imagesrcset).toContain('/media/photo/640.avif 640w')
    expect(preload?.imagesrcset).not.toContain('og.jpg')
  })

  it('sets html lang to ru', () => {
    const app = readFileSync(resolve(process.cwd(), 'apps/web-app/app/app.vue'), 'utf8')
    const config = readFileSync(resolve(process.cwd(), 'apps/web-app/nuxt.config.ts'), 'utf8')
    expect(app).toContain('lang: \'ru\'')
    expect(config).toContain('lang: \'ru\'')
  })
})

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

    expect(decideRedirect({
      hostHeader: 'k39.online',
      protoHeader: 'https',
      path: '/map',
    }).kind).toBe('none')
    expect(decideRedirect({
      hostHeader: 'k39.online',
      protoHeader: 'https',
      path: '/map/forty',
    }).kind).toBe('none')
    expect(decideRedirect({
      hostHeader: 'k39.online',
      protoHeader: 'https',
      path: '/karta',
    }).kind).toBe('none')
    expect(decideRedirect({
      hostHeader: 'k39.online',
      protoHeader: 'https',
      path: '/map/kaliningrad',
    }).kind).toBe('none')

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

describe('default social image', () => {
  it('uses og-default.jpg until a page has its own cover', () => {
    const home = homeDocument()
    expect(home.ogImage).toMatchObject({
      url: 'https://k39.online/og-default.jpg',
      width: 1200,
      height: 630,
      alt: 'K39',
      type: 'image/jpeg',
    })
    const homeHead = headFromDocument(home)
    expect(metaContent(homeHead.meta, 'og:image')).toBe('https://k39.online/og-default.jpg')
    expect(metaContent(homeHead.meta, 'og:image:width')).toBe('1200')
    expect(metaContent(homeHead.meta, 'og:image:height')).toBe('630')
    expect(metaContent(homeHead.meta, 'og:image:type')).toBe('image/jpeg')
    expect(metaContent(homeHead.meta, 'twitter:image')).toBe('https://k39.online/og-default.jpg')
    expect(metaContent(homeHead.meta, 'twitter:card')).toBe('summary_large_image')
    expect(metaContent(homeHead.meta, 'geo.region')).toBe('RU-KGD')
    expect(metaContent(homeHead.meta, 'robots')).toContain('max-image-preview:large')
    expect(home.jsonLd[0]).toMatchObject({
      logo: {
        '@type': 'ImageObject',
        'url': 'https://k39.online/logo/moose-head-512.webp',
        'width': 576,
        'height': 512,
      },
    })

    const cover = {
      url: 'https://k39.online/media/fort.jpg',
      width: 1200,
      height: 800,
      alt: 'Форт',
    }
    const place = placeDocument({ ...placeInput(), image: cover })
    expect(place.ogImage.url).toBe(cover.url)
    const placeHead = headFromDocument(place)
    expect(metaContent(placeHead.meta, 'og:image')).toBe(cover.url)
    expect(metaContent(placeHead.meta, 'og:image:type')).toBeUndefined()
    expect(metaContent(placeHead.meta, 'twitter:image')).toBe(cover.url)

    const pub = resolve(process.cwd(), 'apps/web-app/public')
    expect(existsSync(resolve(pub, 'favicon.png'))).toBe(false)
    expect(existsSync(resolve(pub, 'favicon.svg'))).toBe(false)
    expect(existsSync(resolve(pub, 'og-default.jpg'))).toBe(true)
  })

  it('keeps both favicon.ico links because each has its own key', async () => {
    const head = createHead()
    head.push({ link: [...brandHeadLinks] })
    const rendered = await renderSSRHead(head)
    const icons = [...rendered.headTags.matchAll(/<link[^>]*href="\/favicon\.ico"[^>]*>/g)].map((match) => match[0])
    expect(icons).toHaveLength(2)
    expect(icons.some((tag) => tag.includes('sizes="48x48"'))).toBe(true)
    expect(icons.some((tag) => tag.includes('sizes="any"'))).toBe(true)
    expect(rendered.headTags).toContain('rel="apple-touch-icon"')
    expect(rendered.headTags).toContain('href="/site.webmanifest"')

    const collapsed = createHead()
    collapsed.push({
      link: brandHeadLinks
        .filter((link) => link.href === '/favicon.ico')
        .map(({ key: _key, ...link }) => link),
    })
    const withoutKeys = await renderSSRHead(collapsed)
    expect([...withoutKeys.headTags.matchAll(/href="\/favicon\.ico"/g)]).toHaveLength(1)
  })
})

function metaContent(meta: ReadonlyArray<{ property?: string, name?: string, content: string }>, key: string) {
  return meta.find((tag) => tag.property === key || tag.name === key)?.content
}

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
    expect(indexableHubs(['forty']).map((link) => link.href)).not.toContain('/forty')
    expect(indexableHubs([]).map((link) => link.href)).toContain('/forty')
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
      { path: '/about', outbound: [{ href: '/privacy', text: 'политика' }, { href: '/terms', text: 'соглашение' }] },
      { path: '/privacy', outbound: [{ href: '/soglasie', text: 'согласие' }] },
      { path: '/soglasie', outbound: [{ href: '/privacy', text: 'политика' }] },
      { path: '/terms', outbound: [{ href: '/privacy', text: 'политика' }] },
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
