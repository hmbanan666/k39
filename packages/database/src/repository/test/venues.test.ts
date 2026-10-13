import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { analyticsHits, businesses, offers, regions, slugRedirects, venueListingIntros, venueMedia, venues } from '../../tables'
import { Analytics } from '../analytics'
import { Venues } from '../venues'

const REGION = 'venue-test-town'

const TEXT = 'Кафе у моря с видом на променад и коротким меню. '.repeat(8)

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

async function wipe() {
  const db = useDatabase()
  await db.delete(analyticsHits).where(eq(analyticsHits.eventType, 'impression'))
  await db.delete(venueMedia)
  await db.delete(venueListingIntros)
  await db.delete(venues)
  const [business] = await db.select().from(businesses).where(eq(businesses.slug, 'chaika-biz')).limit(1)
  if (business) {
    await db.delete(offers).where(eq(offers.businessId, business.id))
    await db.delete(businesses).where(eq(businesses.id, business.id))
  }
  await db.delete(regions).where(eq(regions.slug, REGION))
  await db.delete(slugRedirects).where(sql`${slugRedirects.fromPath} like '/zavedeniya/%'`)
}

describe('venues', () => {
  beforeEach(async () => {
    await wipe()
  })

  it('lists by region, dedupes osm ids, and ranks nearby by a fresh check', async () => {
    const db = useDatabase()
    const [region] = await db.insert(regions).values({
      slug: REGION,
      title: 'Тестовый город',
      latitude: 54.94,
      longitude: 20.15,
    }).returning()
    const fresh = await Venues.save({
      slug: 'chaika',
      name: 'Чайка',
      kind: 'coffee',
      regionId: region!.id,
      latitude: 54.71,
      longitude: 20.51,
      description: TEXT,
      status: 'published',
      lastVerifiedAt: daysAgo(10),
    })
    await Venues.save({
      slug: 'old-bar',
      name: 'Старый бар',
      kind: 'bar',
      latitude: 54.711,
      longitude: 20.511,
      description: TEXT,
      status: 'published',
      lastVerifiedAt: daysAgo(400),
    })
    await Venues.save({
      slug: 'unchecked',
      name: 'Без проверки',
      kind: 'cafe',
      latitude: 54.712,
      longitude: 20.512,
      description: TEXT,
      status: 'published',
      lastVerifiedAt: null,
    })
    const year = await Venues.save({
      slug: 'god',
      name: 'Год назад не nearby, но ещё в списке',
      kind: 'cafe',
      latitude: 54.713,
      longitude: 20.509,
      description: TEXT,
      status: 'published',
      lastVerifiedAt: daysAgo(200),
    })
    const near = await Venues.nearbyCandidates([{ latitude: 54.706, longitude: 20.5 }], 2)
    expect(near.map((row) => row.slug).sort()).toEqual(['chaika', 'god'].sort())
    expect(near.find((row) => row.slug === 'chaika')?.distanceKm).toBeLessThan(2)

    const [business] = await db.insert(businesses).values({ slug: 'chaika-biz', name: 'Чайка' }).returning()
    await db.insert(offers).values({
      businessId: business!.id,
      venueId: fresh.id,
      title: 'Кофе',
      terms: 'Второй эспрессо в подарок',
      status: 'active',
    })
    const sponsored = await Venues.nearbyCandidates([{ latitude: 54.706, longitude: 20.5 }], 2)
    expect(sponsored.find((row) => row.slug === 'chaika')?.sponsored).toBe(true)
    expect(sponsored.find((row) => row.slug === 'god')?.sponsored).toBe(false)

    const listed = await Venues.list({ regionSlug: REGION, stale: false, page: 1, pageSize: 20 })
    expect(listed.items.map((item) => item.slug)).toEqual(['chaika'])
    const stale = await Venues.list({ stale: true, page: 1, pageSize: 20 })
    expect(stale.items.map((item) => item.slug).sort()).toEqual(['god', 'old-bar', 'unchecked'].sort())

    const created = await Venues.insertDrafts([
      { slug: 'osm-1', name: 'OSM', kind: 'cafe', osmId: 'node/1', latitude: 1, longitude: 2 },
      { slug: 'osm-1b', name: 'OSM again', kind: 'cafe', osmId: 'node/1', latitude: 1, longitude: 2 },
    ])
    expect(created).toHaveLength(1)
    expect(await Venues.existingOsmIds(['node/1'])).toEqual(new Set(['node/1']))

    await Venues.save({ id: fresh.id, slug: 'chaika-new', name: 'Чайка', kind: 'coffee', description: TEXT, status: 'published', lastVerifiedAt: daysAgo(10) })
    const redirects = await db.select().from(slugRedirects)
    expect(redirects.some((row) => row.fromPath === '/zavedeniya/chaika' && row.toPath === '/zavedeniya/chaika-new')).toBe(true)

    await Venues.setListingIntro(REGION, 'kofe', 'Короткий текст для страницы кофеен.')
    const intro = await Venues.listingIntro(REGION, 'kofe')
    expect(intro?.intro).toContain('кофеен')

    await Analytics.insertHits([
      {
        visitorKey: 'visitor-a',
        visitorMode: 'daily',
        sessionKey: 'session-a',
        consented: false,
        isBot: false,
        eventType: 'impression',
        path: '/fort',
        channel: 'direct',
        target: `venue:${year.slug}`,
      },
      {
        visitorKey: 'bot',
        visitorMode: 'daily',
        sessionKey: 'session-b',
        consented: false,
        isBot: true,
        eventType: 'impression',
        path: '/fort',
        channel: 'direct',
        target: `venue:${year.slug}`,
      },
    ])
    const stats = await Analytics.venueImpressions(daysAgo(2), new Date(Date.now() + 86_400_000).toISOString(), year.slug)
    expect(stats).toEqual([{ slug: year.slug, impressions: 1, visitors: 1 }])
  })
})
