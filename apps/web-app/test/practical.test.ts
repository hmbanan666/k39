import type { AdmissionRow } from '../shared/admission'
import type { ScoreSource } from '../shared/scoring'
import { classifyOfficialUrl } from '@k39/types/official-url'
import { describe, expect, it } from 'vitest'
import TicketsFact from '../app/components/TicketsFact.vue'
import UpcomingEvents from '../app/components/UpcomingEvents.vue'
import { admissionSourceProblem, eventSourceProblem, ownOfficialSourceKind, ticketUrlProblem } from '../server/utils/practical/sources'
import { ADMISSION_UNKNOWN, admissionFree, admissionOffers, admissionRowProblem, admissionView } from '../shared/admission'
import { eventFormTiming, eventInstants, eventLine, eventUpcoming } from '../shared/events'
import { guideFacts } from '../shared/place-guide'
import { emptyResults, issueLabel, scorePage } from '../shared/scoring'
import { collectionDocument, placeDocument, schemaProblems, venueDocument } from '../shared/seo'
import { renderPage } from './helpers/render-page'

const NOW = new Date('2026-11-01T09:00:00Z')

function row(patch: Partial<AdmissionRow> = {}): AdmissionRow {
  return {
    slot: 'adult',
    audience: 'general',
    priceRub: 500,
    condition: null,
    label: null,
    sourceUrl: 'https://museum.example/tickets',
    sourceTitle: 'Сайт музея',
    checkedAt: '2026-10-20',
    sortOrder: 0,
    ...patch,
  }
}

const concert = {
  id: 'e1',
  title: 'Органный вечер',
  startsAt: new Date('2026-11-14T17:00:00Z'),
  endsAt: new Date('2026-11-14T19:00:00Z'),
  allDay: false,
  ticketUrl: 'https://museum.example/tickets/organ',
}

const fair = {
  id: 'e2',
  title: 'Ярмарка ремёсел',
  startsAt: new Date('2026-11-20T22:00:00Z'),
  endsAt: new Date('2026-11-22T22:00:00Z'),
  allDay: true,
  ticketUrl: null,
}

describe('admission rows', () => {
  it('checks price, audience, and condition', () => {
    expect(admissionRowProblem(row())).toBeNull()
    expect(admissionRowProblem(row({ priceRub: 0 }))).toContain('audience free')
    expect(admissionRowProblem(row({ priceRub: 10.5 }))).toContain('целое')
    expect(admissionRowProblem(row({ audience: 'free', priceRub: 100 }))).toContain('priceRub 0')
    expect(admissionRowProblem(row({ audience: 'free', priceRub: 0 }))).toBeNull()
    expect(admissionRowProblem(row({ audience: 'reduced', condition: ' ' }))).toContain('условие')
    expect(admissionRowProblem(row({ audience: 'foreign', condition: 'без гражданства РФ' }))).toBeNull()
    expect(admissionRowProblem(row({ condition: 'а'.repeat(201) }))).toContain('200')
  })

  it('orders fresh rows by audience and hides stale ones', () => {
    const view = admissionView([
      row({ slot: 'free', audience: 'free', priceRub: 0, condition: 'дети до 7 лет' }),
      row({ slot: 'reduced', audience: 'reduced', priceRub: 300, condition: 'студенты' }),
      row({ slot: 'old', priceRub: 200, checkedAt: '2025-01-01' }),
      row({ priceRub: 1200 }),
    ], NOW)
    expect(view.stored).toBe(true)
    expect(view.lines.map((line) => [line.label, line.amount])).toEqual([
      ['Взрослый', `${(1200).toLocaleString('ru-RU')} ₽`],
      ['Льготный', '300 ₽'],
      ['Бесплатно', 'бесплатно'],
    ])
    expect(view.lines[2]!.condition).toBe('дети до 7 лет')
  })

  it('keeps stored true when every row is stale', () => {
    const view = admissionView([row({ checkedAt: '2025-01-01' })], NOW)
    expect(view).toMatchObject({ stored: true, rows: [], lines: [] })
  })

  it('reads isAccessibleForFree from fresh rows only', () => {
    expect(admissionFree(admissionView([row()], NOW))).toBe(false)
    expect(admissionFree(admissionView([row({ audience: 'free', priceRub: 0 })], NOW))).toBe(true)
    expect(admissionFree(admissionView([row({ audience: 'free', priceRub: 0, condition: 'по средам' })], NOW))).toBeNull()
    expect(admissionFree(admissionView([row({ checkedAt: '2025-01-01' })], NOW))).toBeNull()
  })

  it('turns fresh rows into offers with the condition as description', () => {
    const offers = admissionOffers(admissionView([row({ audience: 'reduced', condition: 'пенсионеры', label: 'Пенсионный' })], NOW))
    expect(offers).toEqual([{
      '@type': 'Offer',
      'name': 'Пенсионный',
      'price': 500,
      'priceCurrency': 'RUB',
      'url': 'https://museum.example/tickets',
      'description': 'пенсионеры',
    }])
  })
})

describe('ticket and event sources', () => {
  const own = { socials: [{ url: 'https://vk.com/cafe_own' }], vkCommunityId: 123 }

  it('classifies ticket sellers and listings as aggregators', () => {
    for (const url of [
      'https://kaliningrad.kassir.ru/teatr/1',
      'https://www.ticketland.ru/concert/1',
      'https://radario.ru/events/1',
      'https://kaliningrad.kassy.ru/events/1',
      'https://www.culture.ru/events/1',
      'https://izi.travel/ru/1',
      'https://www.afisha.ru/concert/1',
    ]) {
      expect(classifyOfficialUrl(url)).toBe('aggregator')
    }
  })

  it('takes admission only from the official site', () => {
    expect(admissionSourceProblem('https://museum.example/tickets')).toBeNull()
    for (const url of ['https://radario.ru/events/1', 'https://vk.com/museum', 'https://yandex.ru/maps/org/1', 'https://disk.yandex.ru/i/1']) {
      expect(admissionSourceProblem(url)).toContain('только официальный сайт')
    }
    expect(admissionSourceProblem('ftp://museum.example')).toContain('http(s)')
  })

  it('takes an event from the official site or the venue\'s own VK', () => {
    expect(ownOfficialSourceKind('https://museum.example/afisha', null)).toBe('official')
    expect(ownOfficialSourceKind('https://vk.com/cafe_own?w=wall-123_45', own)).toBe('official_social')
    expect(ownOfficialSourceKind('https://vk.com/wall-123_46', own)).toBe('official_social')
    expect(ownOfficialSourceKind('https://vk.com/other_cafe', own)).toBeNull()
    expect(ownOfficialSourceKind('https://vk.com/cafe_own', null)).toBeNull()
    expect(ownOfficialSourceKind('https://ticketland.ru/concert/1', own)).toBeNull()
    expect(eventSourceProblem('https://vk.com/other_cafe', own)).toContain('«Соцсетей» этого заведения')
    expect(eventSourceProblem('https://vk.com/museum', null)).toContain('У места нет соцсетей')
    expect(eventSourceProblem('https://kassir.ru/1', own)).toContain('Афиша-агрегатор')
  })

  it('lets a ticket link point at a seller but not at a map', () => {
    expect(ticketUrlProblem('https://kaliningrad.kassir.ru/teatr/1')).toBeNull()
    expect(ticketUrlProblem('http://kassir.ru/1')).toContain('https')
    expect(ticketUrlProblem('https://yandex.ru/maps/org/1')).toContain('продавца')
  })
})

describe('event timing', () => {
  it('reads a clock in Kaliningrad time', () => {
    const instants = eventInstants({ allDay: false, startsAt: '2026-11-14T19:00', endsAt: '2026-11-14T21:00' })
    expect(instants).toEqual({ startsAt: concert.startsAt, endsAt: concert.endsAt })
  })

  it('stores a date-only event as local midnights and reads it back', () => {
    const instants = eventInstants({ allDay: true, startsOn: '2026-11-21', endsOn: '2026-11-22' })
    expect(instants).toEqual({ startsAt: fair.startsAt, endsAt: fair.endsAt })
    expect(eventFormTiming(fair)).toEqual({ allDay: true, startsOn: '2026-11-21', endsOn: '2026-11-22' })
  })

  it('rejects mixed or reversed input', () => {
    expect(eventInstants({ allDay: true, startsOn: '2026-11-21', startsAt: '2026-11-21T10:00' })).toBeTypeOf('string')
    expect(eventInstants({ allDay: false, startsOn: '2026-11-21' })).toBeTypeOf('string')
    expect(eventInstants({ allDay: false, startsAt: '2026-11-14T25:00' })).toBeTypeOf('string')
    expect(eventInstants({ allDay: false, startsAt: '2026-11-14T19:00', endsAt: '2026-11-14T18:00' })).toBeTypeOf('string')
    expect(eventInstants({ allDay: true, startsOn: '2026-02-30' })).toBeTypeOf('string')
  })

  it('treats ended, cancelled, and expired events as gone', () => {
    expect(eventUpcoming(concert, NOW)).toBe(true)
    expect(eventUpcoming(concert, new Date('2026-11-14T19:00:00Z'))).toBe(false)
    expect(eventUpcoming({ ...concert, endsAt: null }, new Date('2026-11-14T16:59:00Z'))).toBe(true)
    expect(eventUpcoming({ ...concert, cancelledAt: NOW }, NOW)).toBe(false)
    expect(eventUpcoming({ ...concert, expiredAt: NOW }, NOW)).toBe(false)
  })

  it('prints a stamp and a local clock for a line', () => {
    const line = eventLine(concert, { title: 'Музей', href: '/muzey' })
    expect(line).toMatchObject({
      day: '14',
      month: 'ноя',
      detail: '19:00',
      datetime: '2026-11-14T19:00:00+02:00',
      subject: { title: 'Музей', href: '/muzey' },
    })
    expect(line.when).toBe('14 ноября 2026, 19:00')
    expect(eventLine(fair).detail).toBe('21 ноября 2026 – 22 ноября 2026')
  })
})

describe('admission and events in JSON-LD', () => {
  const placeBase = {
    slug: 'fixture-museum',
    title: 'Музей фикстуры',
    summary: 'Тестовый музей для проверки билетов и событий.',
    categorySlug: 'muzei',
    categoryTitle: 'Музеи',
    regionTitle: 'Калининград',
    latitude: 54.7,
    longitude: 20.5,
    hours: null,
    sources: [],
    now: NOW,
  }

  it('adds offers, isAccessibleForFree, and Event nodes on a place', () => {
    const doc = placeDocument({
      ...placeBase,
      price: 'бесплатно',
      practical: { admission: admissionView([row()], NOW), events: [concert, fair] },
    })
    const place = doc.jsonLd[1] as Record<string, unknown>
    expect(place.isAccessibleForFree).toBe(false)
    expect((place.offers as unknown[]).length).toBe(1)
    const events = doc.jsonLd.filter((node) => (node as Record<string, unknown>)['@type'] === 'Event') as Array<Record<string, unknown>>
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      name: 'Органный вечер',
      startDate: '2026-11-14T19:00:00+02:00',
      endDate: '2026-11-14T21:00:00+02:00',
      location: { '@id': place['@id'] },
      url: concert.ticketUrl,
    })
    expect(events[1]).toMatchObject({ startDate: '2026-11-21', endDate: '2026-11-22', url: place.url })
    expect(schemaProblems(doc.jsonLd)).toEqual([])
  })

  it('drops the price-text free flag once stale rows replace it', () => {
    const doc = placeDocument({
      ...placeBase,
      price: 'бесплатно',
      practical: { admission: admissionView([row({ checkedAt: '2025-01-01' })], NOW) },
    })
    const place = doc.jsonLd[1] as Record<string, unknown>
    expect(place.offers).toBeUndefined()
    expect(place.isAccessibleForFree).toBeUndefined()
  })

  it('keeps the price-text reading with no rows', () => {
    const doc = placeDocument({ ...placeBase, price: 'бесплатно', practical: { admission: admissionView([], NOW) } })
    expect((doc.jsonLd[1] as Record<string, unknown>).isAccessibleForFree).toBe(true)
  })

  it('adds offers and events on a venue', () => {
    const doc = venueDocument({
      slug: 'fixture-cafe-photo',
      name: 'Кафе фикстуры',
      kind: 'cafe',
      kindLabel: 'Кафе',
      description: 'Тестовое кафе для проверки разметки событий и билетов.',
      address: null,
      phone: null,
      website: null,
      latitude: null,
      longitude: null,
      hours: [],
      regionTitle: 'Калининград',
      sources: [],
      practical: { admission: admissionView([row()], NOW), events: [concert] },
    })
    expect(doc.jsonLd.some((node) => (node as Record<string, unknown>)['@type'] === 'Event')).toBe(true)
    expect(doc.jsonLd.some((node) => Array.isArray((node as Record<string, unknown>).offers))).toBe(true)
    expect(schemaProblems(doc.jsonLd)).toEqual([])
  })

  it('puts route tickets on TouristTrip and no Event nodes', () => {
    const doc = collectionDocument({
      path: '/marshruty/fixture-route',
      h1: 'Маршрут фикстуры',
      summary: 'Тестовый маршрут для проверки билетов.',
      items: [],
      kind: 'TouristTrip',
      admission: admissionView([row({ slot: 'route', priceRub: 900 })], NOW),
    })
    const trip = doc.jsonLd[1] as Record<string, unknown>
    expect((trip.offers as Array<Record<string, unknown>>)[0]!.price).toBe(900)
    expect(doc.jsonLd.some((node) => (node as Record<string, unknown>)['@type'] === 'Event')).toBe(false)
    expect(schemaProblems(doc.jsonLd)).toEqual([])
  })
})

describe('коротко and the ticket block', () => {
  it('drops the price row once any admission row is stored', () => {
    const keys = (admissionStored: boolean) => guideFacts({ price: '300 ₽', admissionStored }).map((fact) => fact.key)
    expect(keys(false)).toContain('price')
    expect(keys(true)).not.toContain('price')
  })

  it('renders fresh rows as a table', async () => {
    const html = await renderPage(TicketsFact, { admission: admissionView([row(), row({ slot: 'r', audience: 'reduced', priceRub: 250, condition: 'студенты' })], NOW) })
    expect(html).toContain('Билеты')
    expect(html).toContain('Взрослый')
    expect(html).toContain('500 ₽')
    expect(html).toContain('студенты')
    expect(html).not.toContain(ADMISSION_UNKNOWN)
  })

  it('says «уточняйте» when every row is stale', async () => {
    const html = await renderPage(TicketsFact, { admission: admissionView([row({ checkedAt: '2025-01-01' })], NOW) })
    expect(html).toContain(ADMISSION_UNKNOWN)
    expect(html).not.toContain('500')
  })

  it('renders nothing without rows', async () => {
    const html = await renderPage(TicketsFact, { admission: admissionView([], NOW) })
    expect(html).not.toContain('Билеты')
  })

  it('lists upcoming events with a ticket link and the subject', async () => {
    const html = await renderPage(UpcomingEvents, {
      id: 'blizhayshee',
      title: 'Ближайшее',
      items: [eventLine(concert, { title: 'Музей фикстуры', href: '/fixture-museum' }), eventLine(fair)],
    })
    expect(html).toContain('Ближайшее')
    expect(html).toContain('Органный вечер')
    expect(html).toContain('datetime="2026-11-14T19:00:00+02:00"')
    expect(html).toContain('href="/fixture-museum"')
    expect(html).toContain(concert.ticketUrl)
    expect(html).toContain('Ярмарка ремёсел')
  })

  it('renders nothing with no events', async () => {
    const html = await renderPage(UpcomingEvents, { id: 'blizhayshee', title: 'Ближайшее', items: [] })
    expect(html).not.toContain('Ближайшее')
  })
})

describe('practical points in the score', () => {
  function place(patch: Partial<ScoreSource> = {}): ScoreSource {
    return {
      kind: 'place',
      id: 'place-1',
      path: '/fixture-museum',
      title: 'Музей',
      summary: 'Коротко.',
      body: '',
      howToGet: null,
      hours: null,
      price: null,
      categorySlug: 'muzei',
      categoryTitle: 'Музеи',
      regionTitle: null,
      latitude: null,
      longitude: null,
      sources: [],
      publicationStatus: 'published',
      noindex: false,
      seoTitle: null,
      seoDescription: null,
      factsCheckedAt: null,
      photoCount: 0,
      inRoute: false,
      inCollection: false,
      memberCount: 0,
      inbound: 0,
      contentOutbound: 0,
      orphan: false,
      passport: null,
      results: emptyResults(),
      ...patch,
    }
  }

  const none = { schedule: false, admissionRows: 0, freshAdmission: 0, upcomingEvents: 0 }

  it('passes on fresh admission, an upcoming event, or a schedule', () => {
    expect(scorePage(place()).checks.quality).toContain('no prices')
    expect(scorePage(place({ practical: none })).checks.quality).toContain('no prices')
    expect(scorePage(place({ practical: { ...none, admissionRows: 1, freshAdmission: 1 } })).checks.quality).not.toContain('no prices')
    expect(scorePage(place({ practical: { ...none, upcomingEvents: 1 } })).checks.quality).not.toContain('no prices')
    expect(scorePage(place({ practical: { ...none, schedule: true } })).checks.quality).not.toContain('no prices')
  })

  it('does not count stale admission alone', () => {
    expect(scorePage(place({ practical: { ...none, admissionRows: 2 } })).checks.quality).toContain('no prices')
  })

  it('flags price text beside the table without losing the point', () => {
    const both = scorePage(place({ price: '300 ₽', practical: { ...none, admissionRows: 1, freshAdmission: 1 } }))
    const text = scorePage(place({ price: '300 ₽' }))
    expect(both.checks.quality).toContain('price text conflicts')
    expect(text.checks.quality).not.toContain('price text conflicts')
    expect(both.total).toBe(text.total)
    expect(issueLabel('price text conflicts')).toBe('Цена в тексте спорит с таблицей билетов')
  })
})
