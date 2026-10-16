import type { VenuePageData } from '../app/components/VenuePage.vue'
import { describe, expect, it } from 'vitest'
import VenuePage from '../app/components/VenuePage.vue'
import Consents from '../app/pages/admin/consents.vue'
import { renderPage } from './helpers/render-page'

function venueFixture(): VenuePageData {
  return {
    type: 'venue',
    doc: {
      title: 'Фикстура | K39',
      description: 'Страница фикстуры для проверки вёрстки без базы.',
      canonical: 'https://k39.online/zavedeniya/fixture-cafe-photo',
      robots: 'noindex, nofollow',
      h1: 'Фикстура: кафе с фото',
      crumbs: [{ name: 'Заведения', href: '/zavedeniya' }],
      jsonLd: [],
      ogImage: { url: 'https://k39.online/og-default.jpg', width: 1200, height: 630, alt: 'K39' },
    },
    venue: {
      name: 'Фикстура: кафе с фото',
      kind: 'cafe',
      kindLabel: 'Кафе',
      partner: false,
      address: 'Фикстура, улица Проверки, 1',
      phone: '+7 401 200-00-00',
      website: null,
      price: '',
      avgCheck: '',
      hours: ['пн–пт 10:00–20:00'],
      description: 'Фикстура кафе.',
      html: '<p>Фикстура кафе.</p>',
      slug: 'fixture-cafe-photo',
      latitude: 54.721,
      longitude: 20.502,
      stale: false,
      staleNote: '',
      closed: false,
      closedNote: '',
      sources: [{ title: 'Меню фикстуры', url: 'https://fixture.k39.test/menu' }],
      cuisine: [],
      socials: [{ network: 'instagram', url: 'https://instagram.com/k39_fixture' }],
      bookingUrl: null,
      orderUrl: null,
      deliveryUrl: null,
      menuUrl: 'https://fixture.k39.test/menu',
      reservation: null,
      takeaway: null,
      delivery: null,
      dishes: [],
      summary: 'Фикстура для проверки страницы.',
      checkedAt: null,
      regionTitle: 'Фикстура',
      schedule: null,
      modules: null,
    },
    photos: [],
    cover: null,
    places: [],
    farPlaces: [],
  }
}

describe('db-free page render', () => {
  it('renders a venue page from fixture props', async () => {
    const html = await renderPage(VenuePage, { page: venueFixture() })
    expect(html).toContain('Фикстура: кафе с фото')
    expect(html).toContain('https://instagram.com/k39_fixture')
    expect(html).toContain('Фикстура, улица Проверки, 1')
    expect(html).not.toContain('undefined')
  })

  it('renders the consent admin screen from the sign-in rule', async () => {
    const html = await renderPage(Consents, {})
    expect(html).toContain('когда человек нажимает кнопку входа')
    expect(html).toContain('отдельной галочки нет')
    expect(html).toContain('кнопка входа')
    expect(html).toContain('guest@example.com')
    expect(html).not.toContain('отмечает согласие')
    expect(html).not.toContain('sign-in-checkbox')
  })
})
