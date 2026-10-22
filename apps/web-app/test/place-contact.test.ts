import { describe, expect, it } from 'vitest'
import GuideFactRow from '../app/components/GuideFactRow.vue'
import { checkPlacePhone, checkPlacePhoneSource, checkPlaceSchemaType, checkPlaceWebsite } from '../shared/place-contact'
import { placeDraftChanges } from '../shared/place-draft-diff'
import { guideFacts, websiteLabel } from '../shared/place-guide'
import { jsonLdTypes, PLACE_SCHEMA_TYPES, placeDocument, placeNodeTypes, placeSchemaType, schemaProblems } from '../shared/seo'
import { writingSplit } from '../shared/writing-split'
import { renderPage } from './helpers/render-page'

const base = {
  slug: 'kirha-test',
  title: 'Кирха тест',
  summary: 'Кирха в музейном разделе, проверка типа и контактов в разметке.',
  categorySlug: 'muzei',
  categoryTitle: 'Музеи',
  regionTitle: 'Калининград',
  latitude: 54.7,
  longitude: 20.5,
  hours: null,
  sources: [{ title: 'Сайт прихода', url: 'https://kirha.example.org/' }],
}

function placeNode(doc: ReturnType<typeof placeDocument>) {
  return doc.jsonLd.find((node) => String(node['@id'] ?? '').endsWith('#place'))!
}

describe('place contact checks', () => {
  it('keeps a full number and refuses a fragment or the gap word', () => {
    expect(checkPlacePhone(' +7 4012 30-30-40 ')).toEqual({ ok: true, value: '+7 4012 30-30-40' })
    expect(checkPlacePhone('')).toEqual({ ok: true, value: null })
    expect(checkPlacePhone(null)).toEqual({ ok: true, value: null })
    expect(checkPlacePhone('уточняйте').ok).toBe(false)
    expect(checkPlacePhone('30-30').ok).toBe(false)
    expect(checkPlacePhone(`+7 4012 30-30-40 ${'x'.repeat(200)}`).ok).toBe(false)
  })

  it('takes only the official site as the website', () => {
    expect(checkPlaceWebsite('https://museum.example.org/')).toEqual({ ok: true, value: 'https://museum.example.org/' })
    expect(checkPlaceWebsite('')).toEqual({ ok: true, value: null })
    expect(checkPlaceWebsite('museum.example.org').ok).toBe(false)
    expect(checkPlaceWebsite('https://vk.com/museum').ok).toBe(false)
    expect(checkPlaceWebsite('https://yandex.ru/maps/org/123').ok).toBe(false)
    expect(checkPlaceWebsite('https://2gis.ru/kaliningrad/firm/1').ok).toBe(false)
  })

  it('takes the phone from an official page or the place social page, never a map', () => {
    expect(checkPlacePhoneSource('https://museum.example.org/contacts')).toEqual({ ok: true, value: 'https://museum.example.org/contacts' })
    expect(checkPlacePhoneSource('https://vk.com/museum')).toEqual({ ok: true, value: 'https://vk.com/museum' })
    expect(checkPlacePhoneSource(null).ok).toBe(false)
    expect(checkPlacePhoneSource('ftp://museum.example.org').ok).toBe(false)
    for (const url of ['https://yandex.ru/maps/org/123', 'https://2gis.ru/kaliningrad/firm/1', 'https://www.openstreetmap.org/node/1', 'https://maps.app.goo.gl/abc']) {
      expect(checkPlacePhoneSource(url).ok).toBe(false)
    }
  })

  it('limits the subtype to the allowlist', () => {
    expect(checkPlaceSchemaType('Church')).toEqual({ ok: true, value: 'Church' })
    expect(checkPlaceSchemaType('')).toEqual({ ok: true, value: null })
    expect(checkPlaceSchemaType('Castle').ok).toBe(false)
    expect(checkPlaceSchemaType('church').ok).toBe(false)
  })
})

describe('place schema type', () => {
  it('prefers the stored subtype and falls back to the hub', () => {
    expect(placeSchemaType('muzei')).toBe('Museum')
    expect(placeSchemaType('muzei', 'Church')).toBe('Church')
    expect(placeSchemaType('muzei', 'Castle')).toBe('Museum')
    expect(placeSchemaType('muzei', null)).toBe('Museum')
    expect(placeNodeTypes('muzei', 'Park')).toEqual(['TouristAttraction', 'Park'])
    expect(placeNodeTypes('muzei', 'TouristAttraction')).toBe('TouristAttraction')
    expect(placeNodeTypes('kurorty', 'PerformingArtsTheater')).toEqual(['TouristAttraction', 'PerformingArtsTheater'])
    expect(placeNodeTypes('forty')).toEqual(['TouristAttraction', 'LandmarksOrHistoricalBuildings'])
  })

  it('emits every allowed subtype without a schema problem', () => {
    for (const type of PLACE_SCHEMA_TYPES) {
      const doc = placeDocument({ ...base, schemaType: type })
      expect(jsonLdTypes(placeNode(doc))).toContain(type)
      expect(schemaProblems(doc.jsonLd)).toEqual([])
    }
  })

  it('keeps the hub type when nothing is stored', () => {
    const doc = placeDocument(base)
    expect(placeNode(doc)['@type']).toEqual(['TouristAttraction', 'Museum'])
  })
})

describe('place contact markup', () => {
  it('adds telephone in E.164 and the official site as url', () => {
    const doc = placeDocument({ ...base, phone: '+7 4012 30-30-40', website: 'https://kirha.example.org/' })
    const node = placeNode(doc)
    expect(node.telephone).toBe('+74012303040')
    expect(node.url).toBe('https://kirha.example.org/')
    expect(schemaProblems(doc.jsonLd)).toEqual([])
    const page = doc.jsonLd.find((item) => item['@type'] === 'WebPage')!
    expect(page.url).toBe('https://k39.online/kirha-test')
  })

  it('lists several numbers and keeps the page url without a website', () => {
    const node = placeNode(placeDocument({ ...base, phone: '+7 4012 30-30-40; 8 (911) 851-68-55' }))
    expect(node.telephone).toEqual(['+74012303040', '+79118516855'])
    expect(node.url).toBe('https://k39.online/kirha-test')
  })

  it('omits telephone for the gap word', () => {
    const node = placeNode(placeDocument({ ...base, phone: 'уточняйте' }))
    expect(node).not.toHaveProperty('telephone')
  })
})

describe('practical block rows', () => {
  it('adds «Телефон» with tel links and «Сайт» after the price', () => {
    const rows = guideFacts({ price: '300 ₽', phone: '+7 4012 30-30-40, +7 911 851-68-55', website: 'https://www.kirha.example.org/' })
    expect(rows.map((row) => row.key)).toEqual(['price', 'phone', 'website'])
    expect(rows[1]).toMatchObject({
      label: 'Телефон',
      links: [
        { text: '+7 4012 30-30-40', href: 'tel:+74012303040' },
        { text: '+7 911 851-68-55', href: 'tel:+79118516855' },
      ],
    })
    expect(rows[2]).toMatchObject({ label: 'Сайт', value: 'kirha.example.org', links: [{ href: 'https://www.kirha.example.org/' }] })
  })

  it('drops empty contacts and a website that is not a URL', () => {
    expect(guideFacts({ phone: ' ', website: 'kirha.example.org' })).toEqual([])
    expect(websiteLabel('https://museum.example.org/kontakty/')).toBe('museum.example.org/kontakty')
  })

  it('renders the phone as tel links and the site as an outbound link in server HTML', async () => {
    const [phone, website] = guideFacts({ phone: '+7 4012 30-30-40', website: 'https://kirha.example.org/' })
    const phoneHtml = await renderPage(GuideFactRow, { row: phone })
    expect(phoneHtml).toContain('Телефон')
    expect(phoneHtml).toContain('href="tel:+74012303040"')
    expect(phoneHtml).toContain('+7 4012 30-30-40')
    const siteHtml = await renderPage(GuideFactRow, { row: website })
    expect(siteHtml).toContain('Сайт')
    expect(siteHtml).toContain('href="https://kirha.example.org/"')
    expect(siteHtml).toContain('kirha.example.org')
    expect(siteHtml).toContain('rel=')
    const plain = await renderPage(GuideFactRow, { row: { key: 'price', label: 'Цена', value: '300 ₽' } })
    expect(plain).toContain('300 ₽')
    expect(plain).not.toContain('href')
  })
})

describe('place contact plumbing', () => {
  it('checks phone and URLs as names, not prose', () => {
    const split = writingSplit('place', { phone: '+7 4012 30-30-40', phoneSourceUrl: 'https://a.example.org/c', website: 'https://a.example.org/' })
    expect(split.prose).toEqual([])
    expect(split.names).toEqual(['+7 4012 30-30-40', 'https://a.example.org/c', 'https://a.example.org/'])
  })

  it('shows contact and subtype changes in the pending draft diff', () => {
    const side = {
      title: 'Т',
      slug: 't',
      summary: '',
      body: '',
      status: 'open',
      hours: null,
      price: null,
      howToGet: null,
      latitude: null,
      longitude: null,
      categoryId: null,
      regionId: null,
      sources: [],
      seoTitle: null,
      seoDescription: null,
      ogImage: null,
      noindex: false,
      visitDuration: null,
      bestTime: null,
      faq: [],
      lastVerifiedAt: null,
      authorKind: 'ai',
      publicationStatus: 'published',
    }
    const changes = placeDraftChanges(side, { ...side, phone: '+7 4012 30-30-40', website: 'https://a.example.org/', schemaType: 'Church' })
    expect(changes.map((item) => item.field)).toEqual(['phone', 'website', 'schemaType'])
    expect(changes[2]).toMatchObject({ live: 'по разделу', draft: 'Church' })
  })
})
