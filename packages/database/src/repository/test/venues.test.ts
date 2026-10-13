import { beforeEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { businesses, offerCodes, offers, venues } from '../../tables'
import {
  formatVenueDistance,
  isStale,
  nearbyFresh,
  osmElementToDraft,
  overpassQuery,
  rankNearby,
  resolveVenuePath,
  VenueInputError,
} from '../../venues'
import { Analytics } from '../analytics'
import { Venues } from '../venues'

const FORT = { latitude: 54.656847, longitude: 20.567554 }
const DAY = 86_400_000

function description() {
  return 'Кафе у форта Дёнхофф варит кофе и кормит обедом. '.repeat(8).slice(0, 420)
}

async function wipe() {
  const db = useDatabase()
  await db.delete(offerCodes)
  await db.delete(offers)
  await db.delete(businesses)
  await db.delete(venues)
}

describe('venue policy', () => {
  it('formats metres and kilometres', () => {
    expect(formatVenueDistance(0.4)).toBe('400 м')
    expect(formatVenueDistance(1.23)).toBe('1,2 км')
    expect(formatVenueDistance(12.2)).toBe('12 км')
  })

  it('marks 180 days as stale and drops nearby after 365', () => {
    const now = new Date('2026-10-13T00:00:00.000Z')
    const fresh = new Date(now.getTime() - 10 * DAY).toISOString()
    const aging = new Date(now.getTime() - 200 * DAY).toISOString()
    const old = new Date(now.getTime() - 400 * DAY).toISOString()
    expect(isStale(fresh, now)).toBe(false)
    expect(isStale(aging, now)).toBe(true)
    expect(nearbyFresh(aging, now)).toBe(true)
    expect(nearbyFresh(old, now)).toBe(false)
    expect(nearbyFresh(null, now)).toBe(false)
    expect(isStale(null, now)).toBe(true)
  })

  it('puts one sponsored venue first and leaves the rest by distance', () => {
    const rows = [
      { id: 'near', distanceKm: 0.4, sponsored: false },
      { id: 'partner', distanceKm: 1.2, sponsored: true },
      { id: 'far-partner', distanceKm: 3, sponsored: true },
      { id: 'mid', distanceKm: 2, sponsored: false },
    ]
    expect(rankNearby(rows, { sponsoredSlot: false }).map((row) => row.id)).toEqual(['near', 'partner', 'mid', 'far-partner'])
    const ranked = rankNearby(rows, { sponsoredSlot: true })
    expect(ranked.map((row) => row.id)).toEqual(['partner', 'near', 'mid', 'far-partner'])
    expect(ranked[0]?.partner).toBe(true)
    expect(ranked[1]?.partner).toBe(false)
  })

  it('maps OSM elements and skips a repeat id', () => {
    const draft = osmElementToDraft({
      type: 'node',
      id: 42,
      lat: FORT.latitude,
      lon: FORT.longitude,
      tags: {
        'amenity': 'cafe',
        'cuisine': 'coffee',
        'name:ru': 'Кофейня у форта',
        'opening_hours': 'Mo-Fr 09:00-18:00',
        'addr:street': 'ул. Дзержинского',
        'addr:housenumber': '1',
      },
    })
    expect(draft?.kind).toBe('coffee')
    expect(draft?.osmId).toBe('node/42')
    expect(draft?.slug).toBe('kofeynya-u-forta')
    expect(draft?.hours.days.find((day) => day.weekday === 'mon')?.opens).toBe('09:00')
    expect(osmElementToDraft({ type: 'node', id: 1, lat: 1, lon: 1, tags: { amenity: 'cafe' } })).toBeNull()
    expect(overpassQuery({ latitude: 54.7, longitude: 20.5, radiusMeters: 800 })).toContain('around:800,54.7,20.5')
    expect(resolveVenuePath(['svetlogorsk', 'kofe'], new Set(['svetlogorsk']))).toEqual({
      type: 'listing',
      regionSlug: 'svetlogorsk',
      kind: 'coffee',
    })
  })
})

describe('venue repository', () => {
  beforeEach(async () => {
    await wipe()
  })

  it('dedupes an OSM import and refuses to publish a short description', async () => {
    const draft = osmElementToDraft({
      type: 'way',
      id: 7,
      center: { lat: FORT.latitude, lon: FORT.longitude },
      tags: { amenity: 'restaurant', name: 'Столовая у вала' },
    })
    expect(draft).toBeTruthy()
    const first = await Venues.importDrafts([draft!], null)
    const second = await Venues.importDrafts([draft!], null)
    expect(first.created).toHaveLength(1)
    expect(second.created).toHaveLength(0)
    expect(second.existing).toEqual(first.created)
    const row = await Venues.byId(first.created[0]!)
    expect(row?.status).toBe('draft')
    expect(row?.osmId).toBe('way/7')
    await expect(Venues.update(row!.id, { status: 'published', description: 'Коротко' })).rejects.toBeInstanceOf(VenueInputError)
  })

  it('orders nearby food venues and hides rows older than a year', async () => {
    const now = new Date('2026-10-13T12:00:00.000Z')
    const fresh = new Date(now.getTime() - 10 * DAY).toISOString()
    const aging = new Date(now.getTime() - 200 * DAY).toISOString()
    const old = new Date(now.getTime() - 400 * DAY).toISOString()
    const near = await Venues.create({
      name: 'Ближняя кофейня у форта Дёнхофф',
      kind: 'coffee',
      latitude: FORT.latitude,
      longitude: FORT.longitude,
      status: 'published',
      description: description(),
      lastVerifiedAt: fresh,
    })
    const partner = await Venues.create({
      name: 'Партнёрская столовая у форта',
      kind: 'restaurant',
      latitude: FORT.latitude + 0.01,
      longitude: FORT.longitude,
      status: 'published',
      description: description(),
      lastVerifiedAt: aging,
    })
    await Venues.create({
      name: 'Дальняя пекарня за городом',
      kind: 'bakery',
      latitude: FORT.latitude + 0.08,
      longitude: FORT.longitude,
      status: 'published',
      description: description(),
      lastVerifiedAt: fresh,
    })
    await Venues.create({
      name: 'Старая закусочная без проверки',
      kind: 'fastfood',
      latitude: FORT.latitude,
      longitude: FORT.longitude,
      status: 'published',
      description: description(),
      lastVerifiedAt: old,
    })
    await Venues.create({
      name: 'Черновик кафе',
      kind: 'cafe',
      latitude: FORT.latitude,
      longitude: FORT.longitude,
      status: 'draft',
      lastVerifiedAt: fresh,
    })
    const [business] = await useDatabase().insert(businesses).values({ slug: 'stolovaya', name: 'Столовая' }).returning()
    await useDatabase().insert(offers).values({
      businessId: business!.id,
      venueId: partner.id,
      title: 'Обед',
      terms: 'Скидка по коду',
      status: 'active',
    })
    const found = await Venues.nearby([FORT], now)
    const ids = found.map((row) => row.id)
    expect(ids).toContain(near.id)
    expect(ids).toContain(partner.id)
    expect(ids).toHaveLength(2)
    expect(found[0]?.id).toBe(near.id)
    expect(found.find((row) => row.id === partner.id)?.sponsored).toBe(true)
    const ranked = rankNearby(found, { sponsoredSlot: true })
    expect(ranked[0]?.id).toBe(partner.id)
    expect(ranked[0]?.partner).toBe(true)
    expect(formatVenueDistance(ranked[0]!.distanceKm)).toMatch(/км|м/)
    const stale = await Venues.list({ stale: true })
    expect(stale.map((row) => row.id)).toContain(partner.id)
    const freshRows = await Venues.list({ stale: false, status: 'published' })
    expect(freshRows.map((row) => row.id)).toContain(near.id)
    expect(freshRows.map((row) => row.id)).not.toContain(partner.id)
  })

  it('records a venue pageview and a nearby impression', async () => {
    const venue = await Venues.create({
      name: 'Бар у ворот',
      slug: 'bar-u-vorot',
      kind: 'bar',
      status: 'draft',
    })
    const subject = await Analytics.resolvePath('/zavedeniya/bar-u-vorot')
    expect(subject.venueId).toBe(venue.id)
    await Analytics.insertHits([{
      visitorKey: 'visitor',
      visitorMode: 'daily',
      sessionKey: 'session',
      consented: false,
      isBot: false,
      eventType: 'impression',
      path: '/fort-11-denhoff',
      venueId: venue.id,
      channel: 'direct',
    }, {
      visitorKey: 'visitor',
      visitorMode: 'daily',
      sessionKey: 'session',
      consented: false,
      isBot: false,
      eventType: 'pageview',
      path: '/zavedeniya/bar-u-vorot',
      venueId: venue.id,
      channel: 'direct',
    }])
    const stats = await Analytics.venueStats(venue.id, new Date('2020-01-01'), new Date('2030-01-01'))
    expect(stats).toEqual([{ venueId: venue.id, impressions: 1, pageviews: 1 }])
  })
})
