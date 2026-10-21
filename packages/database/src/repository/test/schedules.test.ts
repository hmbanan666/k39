import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { scheduleIntervals, schedules, venues } from '../../tables'
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
    expect(between).toMatchObject({ currentOpenEnded: false, currentStart: null, currentEnd: null, nextStart: '2026-10-15T08:00:00.000Z' })
  })
})
