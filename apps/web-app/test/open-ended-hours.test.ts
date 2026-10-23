import type { VenuePageData } from '../app/components/VenuePage.vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import OpeningLive from '../app/components/OpeningLive.vue'
import VenuePage from '../app/components/VenuePage.vue'
import { scheduleDetails, scheduleRulesSchema } from '../shared/schedule'
import { renderPage } from './helpers/render-page'

const rules = scheduleRulesSchema.parse({ seasons: [{ week: [{ days: [0, 1, 2, 3, 4, 5, 6], opens: '12:00' }] }] })
const schedule = { rules, sourceUrl: 'https://fixture.k39.test/hours', verifiedAt: '2026-10-14' }

async function cardText(local: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${local}:00+02:00`))
  const wrapper = mount(OpeningLive, { props: { schedule, showUnknown: true, compact: true, hideRemaining: true } })
  await nextTick()
  const text = wrapper.text()
  wrapper.unmount()
  return text
}

describe('open-ended hours on the page and the card', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the hours row on the server', async () => {
    const page: VenuePageData = {
      type: 'venue',
      doc: {
        title: 'Фикстура | K39',
        description: 'Страница фикстуры для проверки вёрстки без базы.',
        canonical: 'https://k39.online/zavedeniya/fixture-cafe-open',
        robots: 'noindex, nofollow',
        h1: 'Фикстура: кафе без времени закрытия',
        crumbs: [{ name: 'Заведения', href: '/zavedeniya' }],
        jsonLd: [],
        ogImage: { url: 'https://k39.online/og-default.jpg', width: 1200, height: 630, alt: 'K39' },
      },
      venue: {
        name: 'Фикстура: кафе без времени закрытия',
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
        slug: 'fixture-cafe-open',
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
        admission: { stored: false, rows: [], lines: [], extrasStored: false, extras: [], extraLines: [] },
        upcoming: [],
      },
      photos: [],
      cover: null,
      places: [],
      farPlaces: [],
    }
    const html = await renderPage(VenuePage, { page })
    expect(html).toContain('Ежедневно с 12:00, закрытие уточняйте')
    expect(html).not.toContain('Закрыто')
  })

  it('shows the card status after opening without a closing time', async () => {
    expect(await cardText('2026-10-14T13:00')).toBe('Открыто с 12:00, закрытие уточняйте')
    expect(await cardText('2026-10-14T23:50')).toBe('Открыто с 12:00, закрытие уточняйте')
    expect(await cardText('2026-10-14T11:30')).toBe('Закрыто, откроется сегодня в 12:00')
  })
})
