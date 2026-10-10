import type { CatalogSnapshot } from '../../types'
import { describe, expect, it } from 'vitest'
import { Catalog } from '../catalog'
import { EventLog } from '../event-log'
import { Place } from '../place'
import { User } from '../user'

const snapshot: CatalogSnapshot = {
  region: { slug: 'kaliningrad', title: 'Калининград' },
  places: [{
    slug: 'fort-11-denhoff',
    title: 'Форт № 11 «Дёнхофф»',
    type: 'fort',
    latitude: 54.656847,
    longitude: 20.567554,
    status: 'open',
    hours: '10:00-18:00',
    sourceUrl: 'https://fortdonhoff.ru/',
    regionSlug: 'kaliningrad',
  }],
  route: {
    slug: 'five-forts',
    title: 'Квест: 5 фортов',
    summary: 'Короткий маршрут',
    regionSlug: 'kaliningrad',
    points: ['fort-11-denhoff'],
  },
  quest: {
    slug: 'five-forts',
    title: 'Квест: 5 фортов',
    summary: 'Короткий маршрут',
    routeSlug: 'five-forts',
    steps: [{ placeSlug: 'fort-11-denhoff', title: 'Форт № 11', prompt: 'Отметьте визит' }],
  },
}

describe('catalog and events', () => {
  it('syncs a place twice and stores a consented event', async () => {
    await Catalog.apply(snapshot)
    await Catalog.apply(snapshot)

    const place = await Place.findBySlug('fort-11-denhoff')
    expect(place?.title).toContain('Дёнхофф')
    expect(place?.status).toBe('open')

    const event = await EventLog.create({
      type: 'page_view',
      placeId: place?.id,
      placeSlug: 'fort-11-denhoff',
      sessionId: 'sess-test',
      consent: true,
    })
    expect(event.consent).toBe(true)
    expect(event.placeSlug).toBe('fort-11-denhoff')
  })

  it('creates a user from an email', async () => {
    const created = await User.create({
      email: `user-${crypto.randomUUID()}@example.com`,
      name: 'Test User',
    })
    expect(created.id).toBeTruthy()
    const found = await User.findByEmail(created.email)
    expect(found?.name).toBe('Test User')
  })
})
