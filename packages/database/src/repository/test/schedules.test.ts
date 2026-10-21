import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { scheduleIntervals, schedules, venues } from '../../tables'
import { formatHoursLines, hoursAreSet, normalizeHours, VenueInputError } from '../../venues'
import { Schedules } from '../schedules'
import { Venues } from '../venues'

const SLUG = 'schedule-open-ended-test'

async function wipe() {
  const db = useDatabase()
  const [row] = await db.select({ id: venues.id }).from(venues).where(eq(venues.slug, SLUG))
  if (row) {
    await db.delete(scheduleIntervals).where(eq(scheduleIntervals.entityId, row.id))
    await db.delete(schedules).where(eq(schedules.entityId, row.id))
    await db.delete(venues).where(eq(venues.id, row.id))
  }
}

describe('schedule availability window', () => {
  afterEach(wipe)

  it('returns the open-ended flag and start of the current interval', async () => {
    await wipe()
    const venue = await Venues.create({
      slug: SLUG,
      name: 'Проверка часов',
      kind: 'cafe',
      status: 'published',
      description: 'Проверка часов без закрытия. '.repeat(12),
      latitude: 54.7,
      longitude: 20.5,
      noindex: true,
    })
    // 2026-10-14 12:00 local to midnight, then a regular day.
    await Schedules.save({ entityType: 'venue', entityId: venue!.id, rules: { mode: 'hours' }, sourceUrl: null, verifiedAt: '2026-10-14' }, [
      { startsAt: '2026-10-14T10:00:00.000Z', endsAt: '2026-10-14T22:00:00.000Z', lastEntryAt: null, openEnded: true },
      { startsAt: '2026-10-15T08:00:00.000Z', endsAt: '2026-10-15T18:00:00.000Z', lastEntryAt: null },
    ])

    const during = (await Schedules.availability('2026-10-14T19:00:00.000Z', { types: ['venue'] })).find((row) => row.slug === SLUG)
    expect(during).toMatchObject({ currentOpenEnded: true, currentStart: '2026-10-14T10:00:00.000Z', currentEnd: '2026-10-14T22:00:00.000Z' })

    const regular = (await Schedules.availability('2026-10-15T12:00:00.000Z', { types: ['venue'] })).find((row) => row.slug === SLUG)
    expect(regular).toMatchObject({ currentOpenEnded: false, currentEnd: '2026-10-15T18:00:00.000Z' })

    const between = (await Schedules.availability('2026-10-15T02:00:00.000Z', { types: ['venue'] })).find((row) => row.slug === SLUG)
    expect(between).toMatchObject({ currentOpenEnded: false, currentStart: null, currentEnd: null, nextStart: '2026-10-15T08:00:00.000Z', unknownDayRules: null })
  })

  it('returns the rules only when a season has days with unknown hours', async () => {
    await wipe()
    const venue = await Venues.create({
      slug: SLUG,
      name: 'Проверка часов',
      kind: 'cafe',
      status: 'published',
      description: 'Проверка часов без выходных. '.repeat(12),
      latitude: 54.7,
      longitude: 20.5,
      noindex: true,
    })
    const rules = { mode: 'hours', seasons: [{ week: [{ days: [1, 2, 3, 4, 5], opens: '10:00', closes: '19:00', breaks: [] }], unknownDays: [6, 0] }] }
    await Schedules.save({ entityType: 'venue', entityId: venue!.id, rules, sourceUrl: null, verifiedAt: '2026-10-14' }, [])
    const row = (await Schedules.availability('2026-10-17T10:00:00.000Z', { types: ['venue'] })).find((item) => item.slug === SLUG)
    expect(row?.unknownDayRules).toEqual(rules)

    await Schedules.save({ entityType: 'venue', entityId: venue!.id, rules: { ...rules, seasons: [{ ...rules.seasons[0], unknownDays: [] }] }, sourceUrl: null, verifiedAt: '2026-10-14' }, [])
    const none = (await Schedules.availability('2026-10-17T10:00:00.000Z', { types: ['venue'] })).find((item) => item.slug === SLUG)
    expect(none?.unknownDayRules).toBeNull()
  })
})

describe('venue hours with an opening time only', () => {
  it('keeps the day open-ended instead of rejecting it', () => {
    const hours = normalizeHours({ days: [{ weekday: 'sat', closed: false, opens: '12:00', closes: null }] })
    expect(hours.days.find((day) => day.weekday === 'sat')).toEqual({ weekday: 'sat', closed: false, opens: '12:00', closes: null })
    expect(hoursAreSet(hours)).toBe(true)
    expect(formatHoursLines(hours)).toContain('сб с 12:00, закрытие уточняйте')
    expect(() => normalizeHours({ days: [{ weekday: 'sat', closed: false, opens: null, closes: '22:00' }] })).toThrow(VenueInputError)
  })
})

describe('venue hours with a day marked unknown', () => {
  it('keeps the day unknown, never a day off', () => {
    const hours = normalizeHours({ days: [
      { weekday: 'mon', closed: false, opens: '10:00', closes: '19:00' },
      { weekday: 'sat', unknown: true, opens: '12:00', closes: null },
      { weekday: 'sun', unknown: true },
    ] })
    expect(hours.days.find((day) => day.weekday === 'sat')).toEqual({ weekday: 'sat', closed: false, unknown: true, opens: null, closes: null })
    expect(hours.days.find((day) => day.weekday === 'tue')).toEqual({ weekday: 'tue', closed: true, opens: null, closes: null })
    expect(formatHoursLines(hours)).toEqual(['пн 10:00-19:00', 'вт-пт выходной', 'сб-вс: часы уточняйте'])
    expect(normalizeHours({ days: [{ weekday: 'sat', closed: true, unknown: true }] }).days.find((day) => day.weekday === 'sat')).toEqual({ weekday: 'sat', closed: true, opens: null, closes: null })
  })
})
