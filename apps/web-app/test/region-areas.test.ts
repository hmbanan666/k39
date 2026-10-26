import { describe, expect, it } from 'vitest'
import { regionView, resolveCenter } from '../server/utils/mcp/regions'
import { placeFields } from '../server/utils/mcp/schemas'
import { venueFields } from '../server/utils/venues/schema'
import { inTown } from '../shared/eat-now'
import { cheaperCityMeta, priceCompareLead, priceListingMeta } from '../shared/price-compare'
import { regionArea, regionLabel } from '../shared/region'
import { areaSearchResults } from '../shared/search-results'
import { placeDocument, venueDocument } from '../shared/seo'

const area = { slug: 'zelenogradsk', title: 'Историческое название', shortTitle: 'Зеленоградск' }

describe('catalogue areas (ADR 0051)', () => {
  it('shares area cases across navigation, food and comparison headings', () => {
    expect(regionArea(area)).toEqual({
      label: 'Зеленоградск и окрестности',
      inside: 'в Зеленоградске и окрестностях',
      of: 'Зеленоградска и окрестностей',
      by: 'Зеленоградску и окрестностям',
    })
    expect(inTown(area.slug, regionLabel(area))).toBe(regionArea(area).inside)
    expect(priceCompareLead(area.slug)).toBe('Сравниваем с другими заведениями Зеленоградска и окрестностей')
    expect(cheaperCityMeta({ regionSlug: area.slug, regionName: regionLabel(area), venueCount: 4 })).toMatchObject({
      h1: 'Где дешевле в Зеленоградске и окрестностях',
      path: '/gde-deshevle/zelenogradsk',
      noindex: true,
    })
    expect(
      priceListingMeta({
        title: 'Капучино',
        slug: 'cappuccino',
        regionSlug: area.slug,
        regionName: regionLabel(area),
        count: 5,
      }),
    ).toMatchObject({
      h1: 'Капучино в Зеленоградске и окрестностях',
      path: '/ceny/cappuccino/zelenogradsk',
      noindex: false,
    })
  })

  it('handles explicit, custom, missing and inherited-property names without inventing a city', () => {
    expect(regionLabel({ ...area, shortTitle: 'Зеленоградск и окрестности' })).toBe(regionLabel(area))
    expect(regionLabel({ ...area, shortTitle: null })).toBe(regionLabel(area))
    const custom = { slug: 'custom', title: 'Побережье' }
    expect(regionLabel(custom)).toBe('Территория «Побережье»')
    expect(inTown(custom.slug, regionLabel(custom))).toBe('на территории «Побережье»')
    expect(regionArea({ ...area, shortTitle: 'Побережье' }).inside).toBe('на территории «Побережье»')
    expect(regionLabel({ ...custom, title: 'Побережье и окрестности' })).toBe('Побережье и окрестности')
    expect(regionLabel({ ...custom, title: '   ' })).toBe('')
    expect(regionLabel(null)).toBe('')
    expect(regionArea(undefined).inside).toBe('на этой территории')
    expect(regionLabel({ slug: 'constructor', title: 'Пример' })).toBe('Территория «Пример»')
  })

  it('keeps search identity, ordering, scores and subject names; presents legacy city kind as an area', () => {
    const rows = [
      {
        kind: 'place' as const,
        path: '/primorsk',
        title: 'Приморск',
        label: 'Курорты',
        region: 'Зеленоградск',
        snippet: 'Текст',
        score: 2,
      },
      {
        kind: 'city' as const,
        path: '/gde-poest-seychas/zelenogradsk',
        title: 'Зеленоградск',
        label: 'Город',
        region: '',
        snippet: '',
        score: 1,
      },
    ]
    const shown = areaSearchResults(rows, [area])
    expect(shown[0]).toEqual({ ...rows[0], region: 'Зеленоградск и окрестности' })
    expect(shown[1]).toEqual({ ...rows[1], title: 'Зеленоградск и окрестности', label: 'Территория каталога' })
    expect(rows[0]?.region).toBe('Зеленоградск')
    expect(areaSearchResults([rows[0]!], [area, { ...area, slug: 'other' }])[0]?.region).toBe(
      'Территория «Зеленоградск»',
    )
  })

  it('preserves full venue addresses and coordinates without deriving locality from the area or address text', () => {
    const address = 'пос. Примерный, ул. Полная, 1'
    const doc = venueDocument({
      slug: 'fixture',
      name: 'Фикстура',
      kind: 'restaurant',
      kindLabel: 'ресторан',
      description: 'Синтетический пример. '.repeat(20),
      regionSlug: area.slug,
      regionTitle: regionLabel(area),
      inTown: regionArea(area).inside,
      address,
      latitude: 54.8,
      longitude: 20.3,
    })
    const node = doc.jsonLd.find((row) => row['@type'] === 'Restaurant')!
    expect(node.address).toEqual({
      '@type': 'PostalAddress',
      'streetAddress': address,
      'addressRegion': 'Калининградская область',
      'addressCountry': 'RU',
    })
    expect(node.geo).toMatchObject({ latitude: 54.8, longitude: 20.3 })
    expect(doc.title).toContain('в Зеленоградске и окрестностях')
    expect(doc.crumbs[2]).toEqual({ name: regionLabel(area), href: '/zavedeniya/zelenogradsk' })
    expect(JSON.stringify(doc.jsonLd)).not.toContain('addressLocality')
    const unknown = venueDocument({
      slug: 'unknown',
      name: 'Фикстура',
      kind: 'cafe',
      description: '',
      regionTitle: regionLabel(area),
      address: null,
    })
    expect(unknown.jsonLd.find((row) => row['@type'] === 'CafeOrCoffeeShop')).not.toHaveProperty('address')
    const ownTitle = placeDocument({
      slug: 'primorsk',
      title: 'Приморск',
      summary: 'Синтетический пример.',
      categorySlug: 'kurorty',
      categoryTitle: 'Курорты',
      regionTitle: regionLabel(area),
      latitude: 54.7,
      longitude: 20.1,
      hours: null,
      sources: [],
    })
    expect(ownTitle.h1).toBe('Приморск')
    expect(JSON.stringify(ownTitle.jsonLd)).not.toContain('addressLocality')
    expect(ownTitle.jsonLd.find((row) => row['@type'] === 'TouristAttraction')).not.toHaveProperty('address')
    expect(
      venueDocument({
        slug: 'custom',
        name: 'Фикстура',
        kind: 'cafe',
        description: '',
        seoTitle: 'Авторский заголовок',
        inTown: regionArea(area).inside,
      }).title,
    ).toBe('Авторский заголовок | K39')
    const long = venueDocument({
      slug: 'long',
      name: 'Длинное название заведения '.repeat(5),
      kind: 'cafe',
      description: '',
      kindLabel: 'кафе',
      inTown: regionArea(area).inside,
    })
    expect(long.title.length).toBeLessThanOrEqual(70)
    expect(long.title).not.toContain('Зеленоградске')
  })

  it('retains MCP region shape and map centre, including null and omission semantics', () => {
    const row = { ...area, id: 'area-1', description: null, latitude: 54.96, longitude: 20.47 }
    expect(regionView(row)).toEqual({
      ...area,
      id: row.id,
      description: null,
      name: row.title,
      center: { latitude: 54.96, longitude: 20.47 },
      coordinates: { latitude: 54.96, longitude: 20.47 },
    })
    expect(resolveCenter({})).toBeUndefined()
    expect(resolveCenter({ center: null })).toEqual({ latitude: null, longitude: null })
    expect(venueFields.regionSlug.parse(null)).toBeNull()
    expect(venueFields.regionSlug.parse(undefined)).toBeUndefined()
    expect(venueFields.regionSlug.parse(area.slug)).toBe(area.slug)
    expect(placeFields.regionSlug.parse(undefined)).toBeUndefined()
    expect(placeFields.regionSlug.parse(area.slug)).toBe(area.slug)
  })
})
