import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import MapCard from '../app/components/map/MapCard.vue'
import VenueCard from '../app/components/VenueCard.vue'
import VenuePage from '../app/components/VenuePage.vue'
import { formatPhoneDisplay, parsePhones, phoneE164List, telHref } from '../shared/phone'
import { schemaProblems, venueDocument } from '../shared/seo'
import { venueActions } from '../shared/venue-actions'

describe('russian phone display', () => {
  it('groups Kaliningrad 4012, a 40153 district code, and a 9xx mobile', () => {
    expect(formatPhoneDisplay('+7 401 2303040')).toBe('+7 4012 30-30-40')
    expect(formatPhoneDisplay('+7 40153 2-23-53')).toBe('+7 40153 2-23-53')
    expect(formatPhoneDisplay('+7 4015 35-00-11')).toBe('+7 40153 5-00-11')
    expect(formatPhoneDisplay('+7 911 851-68-55')).toBe('+7 911 851-68-55')
    expect(formatPhoneDisplay('89118516855')).toBe('+7 911 851-68-55')
    expect(telHref('+7 401 2303040')).toBe('tel:+74012303040')
    expect(telHref('+7 40153 2-23-53')).toBe('tel:+74015322353')
    expect(telHref('+7 911 851-68-55')).toBe('tel:+79118516855')
  })

  it('splits several numbers and does not dial a fragment or a note', () => {
    const raw = '+7 401 2303040;+7 401 2389466'
    expect(formatPhoneDisplay(raw)).toBe('+7 4012 30-30-40; +7 4012 38-94-66')
    expect(phoneE164List(raw)).toEqual(['+74012303040', '+74012389466'])
    expect(telHref(raw)).toBe('tel:+74012303040')
    expect(parsePhones('+7 401 2303040;+7 401 2926426;+7 963 350').map((item) => item.e164)).toEqual(['+74012303040', '+74012926426', ''])
    expect(formatPhoneDisplay('+7 4012 312-312 p6')).toBe('+7 4012 31-23-12 p6')
    expect(telHref('+7 4012 312-312 p6')).toBe('tel:+74012312312')
    expect(telHref('нет')).toBe('')
    expect(formatPhoneDisplay('уточняйте')).toBe('уточняйте')
    expect(phoneE164List('уточняйте')).toEqual([])
  })

  it('keeps an already grouped city, mobile, and parenthesized number', () => {
    expect(formatPhoneDisplay('+7 4012 30-71-50')).toBe('+7 4012 30-71-50')
    expect(formatPhoneDisplay('+7 (4012) 35-76-76')).toBe('+7 4012 35-76-76')
    expect(formatPhoneDisplay('+7 (401) 231-31-38')).toBe('+7 4012 31-31-38')
    expect(formatPhoneDisplay('+7 4012 310-081')).toBe('+7 4012 31-00-81')
    expect(formatPhoneDisplay('+7 4012 312-312')).toBe('+7 4012 31-23-12')
    expect(formatPhoneDisplay('+7 900 569-09-94')).toBe('+7 900 569-09-94')
    expect(formatPhoneDisplay('8 (4012) 30-30-40')).toBe('+7 4012 30-30-40')
    expect(telHref('+7 4012 30-71-50')).toBe('tel:+74012307150')
  })

  it('puts E.164 in JSON-LD and the call button, and leaves the fact text to the formatter', () => {
    const doc = venueDocument({
      slug: 'kruassan-kaliningrad',
      name: 'Круассан',
      kind: 'cafe',
      description: 'Кафе сети на Ленинском проспекте. Завтраки весь день. '.repeat(6),
      phone: '+7 401 2303040;+7 401 2389466',
    })
    const node = doc.jsonLd.find((item) => item['@type'] === 'CafeOrCoffeeShop') as { telephone?: unknown }
    expect(node.telephone).toEqual(['+74012303040', '+74012389466'])
    expect(schemaProblems(doc.jsonLd)).toEqual([])
    const one = venueDocument({
      slug: 'hogo',
      name: 'Хого',
      kind: 'cafe',
      description: 'Кафе. '.repeat(20),
      phone: '+7 911 851-68-55',
    })
    const single = one.jsonLd.find((item) => item['@type'] === 'CafeOrCoffeeShop') as { telephone?: unknown }
    expect(single.telephone).toBe('+79118516855')
    const gap = venueDocument({
      slug: 'bez',
      name: 'Без',
      kind: 'cafe',
      description: 'Кафе. '.repeat(20),
      phone: 'уточняйте',
    })
    const hidden = gap.jsonLd.find((item) => item['@type'] === 'CafeOrCoffeeShop') as { telephone?: unknown }
    expect(hidden.telephone).toBeUndefined()
    expect(venueActions({ phone: '+7 401 2303040;+7 401 2389466' }).primary?.href).toBe('tel:+74012303040')
  })

  it('prints the grouped number on a venue card and a map card tel link', () => {
    const card = mount(VenueCard, {
      props: {
        href: '/zavedeniya/kruassan-kaliningrad',
        name: 'Круассан',
        kindLabel: 'Кафе',
        phone: '+7 401 2303040;+7 401 2389466',
      },
    })
    expect(card.text()).toContain('+7 4012 30-30-40; +7 4012 38-94-66')
    expect(card.find('a.card').attributes('href')).toBe('/zavedeniya/kruassan-kaliningrad')
    expect(card.find('[href^="tel:"]').exists()).toBe(false)

    const map = mount(MapCard, {
      props: {
        sheet: false,
        point: {
          id: 'venue:1',
          title: 'Круассан',
          href: '/zavedeniya/kruassan-kaliningrad',
          kindLabel: 'Кафе',
          summary: '',
          photo: null,
          partner: false,
          stale: false,
          marker: 'cafe',
          phone: '+7 401 2303040;+7 401 2389466',
        },
      },
      global: { stubs: { Icon: true, UiButton: { template: '<a class="open"><slot /></a>' } } },
    })
    const links = map.findAll('a[href^="tel:"]')
    expect(links.map((link) => link.attributes('href'))).toEqual(['tel:+74012303040', 'tel:+74012389466'])
    expect(links.map((link) => link.text())).toEqual(['+7 4012 30-30-40', '+7 4012 38-94-66'])
  })

  it('renders Коротко phone links on the server template', () => {
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('useHead', () => {})
    const page = mount(VenuePage, {
      props: {
        page: {
          type: 'venue',
          doc: { h1: 'Круассан', crumbs: [] },
          venue: {
            name: 'Круассан',
            kind: 'cafe',
            kindLabel: 'Кафе',
            partner: false,
            address: 'Калининград, Ленинский проспект, 63-67',
            phone: '+7 401 2303040;+7 401 2389466',
            website: null,
            price: '',
            avgCheck: '',
            hours: ['Пн–пт 08:00–21:00'],
            description: '',
            html: '',
            slug: 'kruassan-kaliningrad',
            latitude: null,
            longitude: null,
            stale: false,
            staleNote: '',
            closed: false,
            closedNote: '',
            sources: [],
            cuisine: [],
            socials: [],
            bookingUrl: null,
            orderUrl: null,
            deliveryUrl: null,
            menuUrl: null,
            reservation: null,
            takeaway: null,
            delivery: null,
            dishes: [],
            summary: '',
            checkedAt: null,
            regionTitle: 'Калининград',
            schedule: null,
            modules: null,
          },
          photos: [],
          cover: null,
          places: [],
          farPlaces: [],
        },
      },
      global: {
        stubs: {
          ReaderLayout: { template: '<div><slot name="lead" /><slot name="body" /></div>' },
          OpeningLive: true,
          Sticker: true,
          Icon: true,
          Postcard: true,
          UiBreadcrumbs: true,
          UiLink: true,
          MetaLink: { props: ['href'], template: '<a :href="href"><slot /></a>' },
          DirectionsLink: true,
          MapEmbed: true,
          PhotoViewer: true,
          PlacePhoto: true,
          VenueModules: true,
          ProseHtml: true,
        },
      },
    })
    const links = page.findAll('a[href^="tel:"]')
    expect(links.map((link) => link.attributes('href'))).toEqual(['tel:+74012303040', 'tel:+74012303040', 'tel:+74012389466'])
    expect(page.text()).toContain('+7 4012 30-30-40')
    expect(page.text()).toContain('+7 4012 38-94-66')
    expect(page.text()).not.toContain('+7 401 2303040')
  })
})
