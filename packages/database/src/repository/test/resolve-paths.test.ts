import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { places, routes, venues } from '../../tables'
import { Analytics } from '../analytics'

const PLACE = 'hotpath-place'
const ROUTE = 'hotpath-route'
const VENUE = 'hotpath-venue'

async function clearRows() {
  const db = useDatabase()
  await db.delete(venues).where(eq(venues.slug, VENUE))
  await db.delete(routes).where(eq(routes.slug, ROUTE))
  await db.delete(places).where(eq(places.slug, PLACE))
}

describe('batched path resolve', () => {
  afterEach(async () => {
    await clearRows()
  })

  it('resolves places, routes, and venues from one batch, including repeats', async () => {
    await clearRows()
    const db = useDatabase()
    const [place] = await db.insert(places).values({ slug: PLACE, title: 'Hot path place' }).returning({ id: places.id })
    const [route] = await db.insert(routes).values({ slug: ROUTE, title: 'Hot path route' }).returning({ id: routes.id })
    const [venue] = await db.insert(venues).values({ slug: VENUE, name: 'Hot path venue', kind: 'cafe' }).returning({ id: venues.id })
    const paths = [
      `/${PLACE}`,
      `/${PLACE}?utm=1`,
      `/marshruty/${ROUTE}`,
      `/zavedeniya/${VENUE}`,
      `/zavedeniya/${VENUE}/menu`,
      '/no-such-page',
      `/${PLACE}`,
    ]
    const found = await Analytics.resolvePaths([...paths, ...paths])
    expect(found.get(`/${PLACE}`)).toEqual({ placeId: place?.id, routeId: null, venueId: null })
    expect(found.get(`/${PLACE}?utm=1`)).toEqual({ placeId: place?.id, routeId: null, venueId: null })
    expect(found.get(`/marshruty/${ROUTE}`)).toEqual({ placeId: null, routeId: route?.id, venueId: null })
    expect(found.get(`/zavedeniya/${VENUE}`)).toEqual({ placeId: null, routeId: null, venueId: venue?.id })
    expect(found.get(`/zavedeniya/${VENUE}/menu`)).toEqual({ placeId: null, routeId: null, venueId: null })
    expect(found.get('/no-such-page')).toEqual({ placeId: null, routeId: null, venueId: null })
    expect(await Analytics.resolvePath(`/zavedeniya/${VENUE}`)).toEqual({
      placeId: null,
      routeId: null,
      venueId: venue?.id,
    })
    expect(await Analytics.resolvePaths([])).toEqual(new Map())
  })
})
