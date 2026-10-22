import type { VenuePageData } from '../app/components/VenuePage.vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import OpeningLive from '../app/components/OpeningLive.vue'
import VenuePage from '../app/components/VenuePage.vue'
import { scheduleDetails, scheduleRulesSchema } from '../shared/schedule'
import { renderPage } from './helpers/render-page'

const rules = scheduleRulesSchema.parse({ seasons: [{ week: [{ days: [1, 2, 3, 4, 5], opens: '10:00', closes: '19:00' }], unknownDays: [6, 0] }] })
const schedule = { rules, sourceUrl: 'https://fixture.k39.test/hours', verifiedAt: '2026-10-14' }

async function cardText(local: string, props: Record<string, unknown> = {}) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${local}:00+02:00`))
  const wrapper = mount(OpeningLive, { props: { schedule, showUnknown: true, compact: true, hideRemaining: true, ...props } })
  await nextTick()
  const text = wrapper.text()
  wrapper.unmount()
  return text
}

describe('days with unknown hours on the page and the card (ADR 0044)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the hours row on the server', async () => {
    const page: VenuePageData = {
      type: 'venue',
      doc: {
        title: 'Фикстура | K39',
        description: 'Страница фикстуры для проверки вёрстки без базы.',
        canonical: 'https://k39.online/zavedeniya/fixture-cafe-weekdays',
        robots: 'noindex, nofollow',
        h1: 'Фикстура: кафе без часов на выходные',
        crumbs: [{ name: 'Заведения', href: '/zavedeniya' }],
        jsonLd: [],
        ogImage: { url: 'https://k39.online/og-default.jpg', width: 1200, height: 630, alt: 'K39' },
      },
      venue: {
        name: 'Фикстура: кафе без часов на выходные',
        kind: 'cafe',
        kindLabel: 'Кафе',
        partner: false,
        address: 'Фикстура, улица Проверки, 1',
        phone: '+7 401 200-00-00',
        website: null,
        price: '',
        avgCheck: '',
        hours: scheduleDetails(rules),
        description: 'Фикстура кафе.',
        html: '<p>Фикстура кафе.</p>',
        slug: 'fixture-cafe-weekdays',
        latitude: 54.724,
        longitude: 20.505,
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
        notices: [],
        modules: null,
        admission: { stored: false, rows: [], lines: [] },
        upcoming: [],
      },
      photos: [],
      cover: null,
      places: [],
      farPlaces: [],
    }
    const html = await renderPage(VenuePage, { page })
    expect(html).toContain('Пн–пт 10:00–19:00; сб, вс: часы уточняйте')
    expect(html).not.toMatch(/(?:сб|вс) выходн/)
  })

  it('says today is unknown on the card, never closed', async () => {
    expect(await cardText('2026-10-17T12:00')).toBe('Сегодня часы уточняйте')
    expect(await cardText('2026-10-17T12:00', { hasHours: true, showUnknown: false })).toBe('Сегодня часы уточняйте')
    expect(await cardText('2026-10-16T21:00')).toBe('Закрыто')
    expect(await cardText('2026-10-16T12:00')).toBe('Открыто до 19:00')
  })

  it('keeps «Часы не проверены» for an unverified schedule', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T12:00:00+02:00'))
    const wrapper = mount(OpeningLive, { props: { schedule: { ...schedule, verifiedAt: null }, hasHours: true } })
    await nextTick()
    expect(wrapper.text()).toBe('Часы не проверены, уточняйте')
    wrapper.unmount()
  })
})
