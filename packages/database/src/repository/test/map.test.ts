import { eq, inArray } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { businesses, facts, offers, places, routePoints, routes, venues } from '../../tables'
import { Facts } from '../facts'
import { MapCatalog } from '../map'

const HERE = { latitude: 54.71, longitude: 20.51 }

const description = 'Кофейня на карте варит кофе и кормит обедом после прогулки. '.repeat(8).slice(0, 420)

const VENUE_SLUGS = ['map-pin-cafe', 'map-pin-far', 'map-pin-draft']

async function wipe() {
  const db = useDatabase()
  const rows = await db.select({ id: venues.id }).from(venues).where(inArray(venues.slug, VENUE_SLUGS))
  const ids = rows.map((row) => row.id)
  const placeIds = (await db.select({ id: places.id }).from(places).where(inArray(places.slug, ['map-pin-place', 'map-pin-far-place']))).map((row) => row.id)
  const subjectIds = [...ids, ...placeIds]
  if (subjectIds.length) {
    await db.delete(facts).where(inArray(facts.subjectId, subjectIds))
  }
  if (ids.length) {
    await db.delete(offers).where(inArray(offers.venueId, ids))
  }
  await db.delete(businesses).where(eq(businesses.slug, 'map-pin-biz'))
  const [route] = await db.select({ id: routes.id }).from(routes).where(eq(routes.slug, 'map-pin-route')).limit(1)
  if (route) {
    await db.delete(routePoints).where(eq(routePoints.routeId, route.id))
    await db.delete(routes).where(eq(routes.id, route.id))
  }
  if (ids.length) {
    await db.delete(venues).where(inArray(venues.id, ids))
  }
  await db.delete(places).where(inArray(places.slug, ['map-pin-place', 'map-pin-far-place']))
}

describe('map catalog', () => {
  beforeEach(wipe)

  it('keeps published points inside the walking radius and reads the active offer', async () => {
    const db = useDatabase()
    const insertedPlaces = await db.insert(places).values([
      {
        slug: 'map-pin-place',
        title: 'Тестовое место на карте',
        summary: 'Короткий текст для карточки.',
        publicationStatus: 'published',
        latitude: HERE.latitude,
        longitude: HERE.longitude,
      },
      {
        slug: 'map-pin-far-place',
        title: 'Дальнее место',
        summary: 'Вне пешей дистанции.',
        publicationStatus: 'published',
        latitude: 10,
        longitude: 10,
      },
    ]).returning()
    const [route] = await db.insert(routes).values({
      slug: 'map-pin-route',
      title: 'Тестовый маршрут',
      body: '',
      publicationStatus: 'published',
    }).returning()
    const focus = insertedPlaces.find((row) => row.slug === 'map-pin-place')
    await db.insert(routePoints).values({
      routeId: route!.id,
      placeId: focus!.id,
      position: 1,
    })
    const near = await db.insert(venues).values({
      slug: 'map-pin-cafe',
      name: 'Кофейня на карте',
      kind: 'coffee',
      description,
      status: 'published',
      latitude: HERE.latitude + 0.004,
      longitude: HERE.longitude,
    }).returning()
    const [farVenue] = await db.insert(venues).values([
      {
        slug: 'map-pin-far',
        name: 'Дальняя кофейня',
        kind: 'coffee',
        description,
        status: 'published',
        latitude: HERE.latitude + 0.2,
        longitude: HERE.longitude,
      },
      {
        slug: 'map-pin-draft',
        name: 'Черновик на карте',
        kind: 'cafe',
        description: '',
        status: 'draft',
        latitude: HERE.latitude,
        longitude: HERE.longitude,
      },
    ]).returning()
    const [business] = await db.insert(businesses).values({ slug: 'map-pin-biz', name: 'Карта' }).returning()
    await db.insert(offers).values({
      businessId: business!.id,
      venueId: near[0]!.id,
      title: 'Кофе в подарок',
      terms: 'Покажите карточку',
      status: 'active',
    })

    const far = insertedPlaces.find((row) => row.slug === 'map-pin-far-place')!
    await pointFact('place', far.id, HERE.latitude, HERE.longitude)
    await pointFact('place', focus!.id, 10, 10)
    await pointFact('venue', farVenue!.id, HERE.latitude, HERE.longitude)

    const placeRows = await MapCatalog.places({ origins: [HERE], radiusKm: 1.2, limit: 50 })
    const slugs = placeRows.map((row) => row.slug)
    expect(slugs).not.toContain('map-pin-place')
    expect(slugs).toContain('map-pin-far-place')
    expect(placeRows.find((row) => row.slug === 'map-pin-far-place')?.latitude).toBeCloseTo(HERE.latitude)

    const venueRows = await MapCatalog.venues({ origins: [HERE], radiusKm: 1.2, limit: 50 })
    expect(venueRows.map((row) => row.slug)).toContain('map-pin-cafe')
    expect(venueRows.map((row) => row.slug)).toContain('map-pin-far')
    expect(venueRows.find((row) => row.slug === 'map-pin-far')?.latitude).toBeCloseTo(HERE.latitude)
    expect(venueRows.map((row) => row.slug)).not.toContain('map-pin-draft')
    const stops = await MapCatalog.routeStops('map-pin-route')
    expect(stops.map((row) => row.placeSlug)).toEqual(['map-pin-place'])

    const catalog = await MapCatalog.places({ origins: [], radiusKm: null, limit: 800 })
    expect(catalog.map((row) => row.slug)).toEqual(expect.arrayContaining(['map-pin-place', 'map-pin-far-place']))

    const offerRows = await MapCatalog.activeOffers([near[0]!.id])
    expect(offerRows.get(near[0]!.id)).toMatchObject({ title: 'Кофе в подарок' })
    expect(await MapCatalog.activeOffers([])).toEqual(new Map())
  })
})

async function pointFact(subjectType: 'place' | 'venue', subjectId: string, latitude: number, longitude: number) {
  await Facts.upsert({
    kind: 'coordinates',
    subjectType,
    subjectId,
    slot: 'coordinates',
    value: { latitude, longitude },
    valueHash: 'c'.repeat(64),
    sourceUrl: null,
    sourceTitle: null,
    sourceKind: 'none',
    checkedAt: '2026-01-01T00:00:00.000Z',
    ttlDays: 365,
    confidence: 'stated',
    actor: 'editor',
  }, [{ consumerType: subjectType, consumerId: subjectId, path: 'short.coordinates' }])
}
