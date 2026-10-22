import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { applyFixtures, FIXTURE_SLUGS } from '../../seed/fixtures'
import { PRICE_CATALOG } from '../../seed/price-catalog'
import { placeMedia, venues } from '../../tables'
import { Editor } from '../content'
import { Prices } from '../prices'
import { Schedules } from '../schedules'
import { Venues } from '../venues'

describe('ui fixtures', () => {
  it('upserts the catalog, the town matrix, and a module page, then does it again', async () => {
    const first = await applyFixtures()
    const second = await applyFixtures()
    expect(first.catalog).toBe(32)
    expect(second.catalog).toBe(32)
    expect(PRICE_CATALOG).toHaveLength(32)

    const catalog = await Prices.items()
    for (const item of PRICE_CATALOG) {
      expect(catalog.some((row) => row.slug === item.slug && row.category === item.category)).toBe(true)
    }

    const photo = await Venues.bySlug(FIXTURE_SLUGS.cafePhoto)
    const plain = await Venues.bySlug(FIXTURE_SLUGS.cafePlain)
    const peer = await Venues.bySlug(FIXTURE_SLUGS.cafePeer)
    const nowhere = await Venues.bySlug(FIXTURE_SLUGS.cafeNoCoords)
    expect(photo?.socials).toEqual([{ network: 'instagram', url: 'https://instagram.com/k39_fixture' }])
    expect(photo?.latitude).toBeTypeOf('number')
    expect(photo?.priceBand).toBe('low')
    expect(Array.isArray(photo?.modules) && photo.modules).toHaveLength(9)
    expect(plain?.latitude).toBeTypeOf('number')
    expect(nowhere?.latitude).toBeNull()
    expect(nowhere?.longitude).toBeNull()

    const prices = await Prices.forItem('cappuccino')
    const ids = new Set([photo!.id, plain!.id, peer!.id])
    expect(prices.filter((row) => ids.has(row.venueId))).toHaveLength(3)

    const schedule = await Schedules.get('venue', photo!.id)
    expect(schedule?.sourceUrl).toBe('https://fixture.k39.test/hours')
    const openEnded = await Venues.bySlug(FIXTURE_SLUGS.cafeOpenEnded)
    const openEndedSchedule = await Schedules.get('venue', openEnded!.id)
    expect((openEndedSchedule?.rules as { seasons: Array<{ week: Array<Record<string, unknown>> }> }).seasons[0]?.week[0]).toEqual({ days: [0, 1, 2, 3, 4, 5, 6], opens: '12:00', breaks: [] })
    const unknownDays = await Venues.bySlug(FIXTURE_SLUGS.cafeUnknownDays)
    const unknownDaysSchedule = await Schedules.get('venue', unknownDays!.id)
    expect((unknownDaysSchedule?.rules as { seasons: Array<{ unknownDays?: number[] }> }).seasons[0]?.unknownDays).toEqual([6, 0])
    const seasons = await Venues.bySlug(FIXTURE_SLUGS.cafeSeasons)
    const seasonsRules = (await Schedules.get('venue', seasons!.id))?.rules as { seasons: unknown[], closures: unknown[], exceptions: unknown[] }
    expect(seasonsRules.seasons).toHaveLength(2)
    expect(seasonsRules.closures).toHaveLength(1)
    expect(seasonsRules.exceptions).toHaveLength(1)

    const hub = await Editor.placeBySlug(FIXTURE_SLUGS.placeHub)
    const covers = await useDatabase().select().from(placeMedia).where(eq(placeMedia.placeId, hub!.id))
    expect(covers.some((row) => row.isCover)).toBe(true)
    const contact = await Editor.placeBySlug(FIXTURE_SLUGS.placeContact)
    expect(contact?.phone).toContain('+7 4012')
    expect(contact?.website).toBe('https://fixture.k39.test/')
    expect(contact?.schemaType).toBe('Church')
    const plainTown = await Editor.placeBySlug(FIXTURE_SLUGS.townPlain)
    expect(plainTown).toBeUndefined()

    const collection = (await Editor.listCollections()).find((row) => row.slug === FIXTURE_SLUGS.collection)
    const types = (collection?.modules ?? []).map((module) => module.type)
    expect(types).toEqual(['text', 'month-stats', 'picker', 'ideas', 'plans', 'places', 'months'])

    const rows = await useDatabase().select().from(venues).where(eq(venues.slug, FIXTURE_SLUGS.cafePhoto))
    expect(rows).toHaveLength(1)
  })
})
