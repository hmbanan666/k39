import type { VenuePageData } from '../app/components/VenuePage.vue'
import type { PublicNotice } from '../shared/notices'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import OpeningLive from '../app/components/OpeningLive.vue'
import TemporaryNotices from '../app/components/TemporaryNotices.vue'
import VenuePage from '../app/components/VenuePage.vue'
import { liveStatus, liveStatusText, normalizeNotice, noticeDateLine, noticeInputSchema, noticeLines, noticeNeedsCheck, noticeOverlapProblem, noticeState, noticeTextProblem, noticeToday, statusWindows, visibleNotices } from '../shared/notices'
import { scheduleDetails, scheduleRulesSchema } from '../shared/schedule'
import { renderPage } from './helpers/render-page'

const rules = scheduleRulesSchema.parse({ seasons: [{ week: [{ days: [0, 1, 2, 3, 4, 5, 6], opens: '09:00', closes: '21:00' }] }] })
const schedule = { rules, sourceUrl: 'https://fixture.k39.test/hours', verifiedAt: '2026-10-14' }
const source = { sourceUrl: 'https://fixture.k39.test/news', sourceTitle: 'Новости фикстуры' }

const relocation = { kind: 'relocation' as const, from: '2026-11-01', to: '2026-11-13', text: 'Кафе работает по этому адресу.', address: 'ул. Ленина, 5А', ...source }
const closed = { kind: 'closed' as const, from: '2026-11-20', to: '2026-11-21', text: 'Кафе не работает.', address: null, ...source }

describe('notice windows', () => {
  it('compares the dates with today in Kaliningrad', () => {
    expect(noticeToday(new Date('2026-10-31T21:59:00Z'))).toBe('2026-10-31')
    expect(noticeToday(new Date('2026-10-31T22:00:00Z'))).toBe('2026-11-01')
    expect(noticeState(relocation, '2026-10-31')).toBe('upcoming')
    expect(noticeState(relocation, '2026-11-01')).toBe('current')
    expect(noticeState(relocation, '2026-11-13')).toBe('current')
    expect(noticeState(relocation, '2026-11-14')).toBe('expired')
    expect(noticeState({ ...relocation, to: null }, '2030-01-01')).toBe('current')
  })

  it('orders current before upcoming, then by kind and start', () => {
    const other = { ...closed, kind: 'other' as const, from: '2026-11-02', to: '2026-11-03' }
    const renovation = { ...closed, kind: 'renovation' as const, from: '2026-10-01', to: '2026-10-31' }
    const shown = visibleNotices([other, closed, relocation, renovation], '2026-11-02')
    expect(shown.map((row) => [row.kind, row.state])).toEqual([['relocation', 'current'], ['other', 'current'], ['closed', 'upcoming']])
  })

  it('prints exact Russian dates with no em dash', () => {
    expect(noticeDateLine(relocation)).toBe('с 1 ноября 2026 по 13 ноября 2026')
    expect(noticeDateLine({ from: '2026-11-01', to: null })).toBe('с 1 ноября 2026')
    expect(noticeLines(relocation)).toEqual({ dates: 'с 1 ноября 2026 по 13 ноября 2026', label: 'Другой адрес', text: relocation.text, address: 'ул. Ленина, 5А' })
    expect(noticeLines({ ...closed, kind: 'other' }).label).toBe('')
    expect(noticeLines({ ...closed, address: 'ул. Ленина, 1' }).address).toBeNull()
  })

  it('flags only open-ended rows checked more than 30 days ago', () => {
    expect(noticeNeedsCheck({ to: null, checkedAt: '2026-09-01' }, '2026-10-22')).toBe(true)
    expect(noticeNeedsCheck({ to: null, checkedAt: '2026-10-01' }, '2026-10-22')).toBe(false)
    expect(noticeNeedsCheck({ to: '2026-11-01', checkedAt: '2025-01-01' }, '2026-10-22')).toBe(false)
  })
})

describe('notice input', () => {
  const parse = (value: Record<string, unknown>) => normalizeNotice(noticeInputSchema.parse({ ...relocation, checkedAt: '2026-10-20', ...value }), '2026-10-22')

  it('rejects relative words, a clock, and a price as whole words only', () => {
    for (const word of ['пока', 'Сейчас', 'скоро', 'временно', 'сегодня', 'завтра', 'вчера', 'на  днях']) {
      expect(noticeTextProblem(`Кафе ${word} работает.`, 'Текст')).not.toBeNull()
    }
    expect(noticeTextProblem('Покажем выставку, скоростной поезд и временной ряд.', 'Текст')).toBeNull()
    expect(noticeTextProblem('Открыто до 9:30.', 'Текст')).toMatch(/расписании/)
    expect(noticeTextProblem('Билет 300 руб.', 'Текст')).toMatch(/цены/)
    expect(noticeTextProblem('Вход 300 ₽.', 'Текст')).toMatch(/цены/)
    expect(noticeTextProblem('Откроется 1 мая 2027 года.', 'Текст')).toBeNull()
  })

  it('needs an address only for a relocation and a reason only without an end', () => {
    expect(parse({}).address).toBe('ул. Ленина, 5А')
    expect(() => parse({ address: null })).toThrow(/адрес/)
    expect(() => parse({ kind: 'closed' })).toThrow(/только для переезда/)
    expect(() => parse({ to: null })).toThrow(/причина/)
    expect(parse({ to: null, openEndedReason: 'Источник не сообщил' }).openEndedReason).toBe('Источник не сообщил')
    expect(() => parse({ to: '2026-10-31' })).toThrow(/раньше/)
  })

  it('refuses overlapping closed and renovation, and two rows of one kind', () => {
    const renovation = { kind: 'renovation' as const, from: '2026-11-21', to: '2026-12-01' }
    expect(noticeOverlapProblem([closed, renovation], '2026-10-22')).toMatch(/не могут пересекаться/)
    expect(noticeOverlapProblem([closed, { ...closed, from: '2026-11-21', to: '2026-11-25' }], '2026-10-22')).toMatch(/пересекаются/)
    expect(noticeOverlapProblem([closed, relocation], '2026-10-22')).toBeNull()
    expect(noticeOverlapProblem([{ ...closed, from: '2026-01-01', to: '2026-01-31' }, { ...closed, from: '2026-01-10', to: '2026-12-31' }], '2026-10-22')).toBeNull()
  })
})

describe('closed notice status', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('overrides an open schedule only inside a closed window', () => {
    const windows = statusWindows([{ ...closed, state: 'upcoming' }, { ...relocation, state: 'current' }] as PublicNotice[])
    expect(windows).toEqual([{ kind: 'closed', from: '2026-11-20', to: '2026-11-21' }])
    const inside = new Date('2026-11-20T10:00:00+02:00')
    const value = liveStatus(schedule, windows, inside)
    expect(value.status).toBe('closed')
    expect(value.opensAt).toBeNull()
    expect(liveStatusText(value, inside)).toBe('Закрыто с 20 ноября 2026 по 21 ноября 2026')
    expect(liveStatus(schedule, windows, new Date('2026-11-19T10:00:00+02:00')).status).toBe('open')
    expect(liveStatus(schedule, windows, new Date('2026-11-22T10:00:00+02:00')).status).toBe('open')
    expect(liveStatus(null, windows, inside).status).toBe('closed')
    expect(liveStatus(schedule, [{ ...relocation }], new Date('2026-11-05T10:00:00+02:00')).status).toBe('open')
  })

  it('shows the closed date line on the hydrated chip', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-20T12:00:00+02:00'))
    const wrapper = mount(OpeningLive, { props: { schedule, notices: [{ kind: 'closed', from: '2026-11-20', to: '2026-11-21' }], compact: true, showUnknown: true } })
    await nextTick()
    expect(wrapper.text()).toBe('Закрыто с 20 ноября 2026 по 21 ноября 2026')
    wrapper.unmount()
  })
})

describe('notice render', () => {
  const shown: PublicNotice[] = [{ ...relocation, state: 'current' }, { ...closed, state: 'upcoming' }]

  it('renders the hero aside and «Коротко» rows from one helper', async () => {
    const hero = await renderPage(TemporaryNotices, { notices: shown, variant: 'hero' })
    expect(hero).toContain('<aside')
    expect(hero).toContain('На эти даты')
    expect(hero).toContain('с 1 ноября 2026 по 13 ноября 2026')
    expect(hero).toContain('ул. Ленина, 5А')
    expect(hero.indexOf('Другой адрес')).toBeLessThan(hero.indexOf('Закрыто'))
    const facts = await renderPage(TemporaryNotices, { notices: shown, variant: 'facts' })
    expect(facts).not.toContain('На эти даты')
    expect(facts).toContain('с 20 ноября 2026 по 21 ноября 2026')
    expect(facts).toContain('Кафе не работает.')
  })

  it('renders nothing without visible notices', async () => {
    expect(await renderPage(TemporaryNotices, { notices: [], variant: 'hero' })).not.toContain('aside')
  })

  it('puts the notice on the venue page and keeps the stored address and JSON-LD', async () => {
    const page: VenuePageData = {
      type: 'venue',
      doc: {
        title: 'Фикстура | K39',
        description: 'Страница фикстуры для проверки вёрстки без базы.',
        canonical: 'https://k39.online/zavedeniya/fixture-cafe-photo',
        robots: 'noindex, nofollow',
        h1: 'Фикстура: кафе',
        crumbs: [{ name: 'Заведения', href: '/zavedeniya' }],
        jsonLd: [],
        ogImage: { url: 'https://k39.online/og-default.jpg', width: 1200, height: 630, alt: 'K39' },
      },
      venue: {
        name: 'Фикстура: кафе',
        kind: 'cafe',
        kindLabel: 'Кафе',
        partner: false,
        address: 'Фикстура, улица Проверки, 1',
        phone: null,
        website: null,
        price: '',
        avgCheck: '',
        hours: scheduleDetails(rules),
        description: 'Фикстура кафе.',
        html: '<p>Фикстура кафе.</p>',
        slug: 'fixture-cafe-photo',
        latitude: 54.721,
        longitude: 20.502,
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
        summary: 'Фикстура для проверки страницы.',
        checkedAt: null,
        regionTitle: 'Фикстура',
        schedule,
        notices: shown,
        modules: null,
      },
      photos: [],
      cover: null,
      places: [],
      farPlaces: [],
    }
    const html = await renderPage(VenuePage, { page })
    expect(html).toContain('На эти даты')
    expect(html).toContain('ул. Ленина, 5А')
    expect(html).toContain('Фикстура, улица Проверки, 1')
    expect(html.match(/с 1 ноября 2026 по 13 ноября 2026/g)).toHaveLength(2)
  })
})
