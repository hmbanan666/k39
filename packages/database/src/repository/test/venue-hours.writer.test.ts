// Lives in the database suite so it uses that Postgres.
// Typechecked from apps/web-app/tsconfig.writer-test.json, where Nuxt
// auto-imports exist. This package's tsc excludes the file.
import type { ScheduleRules } from '../../../../../apps/web-app/shared/schedule'
import { eq, inArray } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enterContentScope } from '../../../../../apps/web-app/server/utils/access'
import { saveOwnerVenue } from '../../../../../apps/web-app/server/utils/cabinet/flow'
import { resetCabinetSlots } from '../../../../../apps/web-app/server/utils/cabinet/rate'
import { loadHoursForm, loadSchedule, saveSchedule } from '../../../../../apps/web-app/server/utils/schedule'
import { createVenue, saveImportedHours, updateVenue } from '../../../../../apps/web-app/server/utils/venues/write'
import { rulesFromVenueHours, weeklyTableRules } from '../../../../../apps/web-app/shared/schedule'
import { hoursPayload } from '../../../../../apps/web-app/shared/venue-hours-form'
import { useDatabase } from '../../database'
import { HOURS_NOTE_MAX, HOURS_NOTE_TOO_LONG } from '../../hours-note'
import {
  facts,
  mcpAudits,
  revisions,
  schedules,
  users,
  venueAudits,
  venueMembers,
  venues,
  verificationQueue,
} from '../../tables'
import { normalizeHours, parseOsmHours, VenueInputError } from '../../venues'
import { Schedules } from '../schedules'

const SOURCE = 'https://cafe.example/hours'

const singleSeason: ScheduleRules = {
  mode: 'hours',
  seasons: [{ week: [{ days: [1, 2, 3, 4, 5], opens: '10:00', closes: '19:00', breaks: [] }], unknownDays: [0] }],
  closures: [{ weekday: 1, nth: -1, label: 'Санитарный день' }],
  holidays: 'closed',
  exceptions: [{ date: '2026-12-31', closed: true, note: 'Закрыто' }],
  occurrences: [],
  note: 'Кухня до 18:30',
  needsCheck: false,
}

const twoSeasons: ScheduleRules = {
  ...singleSeason,
  seasons: [
    {
      from: '06-01',
      to: '08-31',
      week: [{ days: [0, 1, 2, 3, 4, 5, 6], opens: '09:00', closes: '23:00', breaks: [] }],
    },
    {
      week: [
        { days: [1, 2, 3, 4, 5], opens: '10:00', closes: '19:00', breaks: [] },
        { days: [6], opens: '11:00', closes: '17:00', breaks: [] },
      ],
    },
  ],
}

const venueIds: string[] = []
const userIds: string[] = []

afterEach(async () => {
  enterContentScope('editor')
  resetCabinetSlots()
  const database = useDatabase()
  for (const id of venueIds) {
    await database.delete(verificationQueue).where(eq(verificationQueue.entityId, id))
    await database.delete(revisions).where(eq(revisions.entityId, id))
    await database.delete(mcpAudits).where(eq(mcpAudits.entityId, id))
    await database.delete(schedules).where(eq(schedules.entityId, id))
    await database.delete(facts).where(eq(facts.subjectId, id))
    await database.delete(venueAudits).where(eq(venueAudits.venueId, id))
  }
  if (venueIds.length) {
    await database.delete(venues).where(inArray(venues.id, venueIds))
  }
  if (userIds.length) {
    await database.delete(users).where(inArray(users.id, userIds))
  }
  venueIds.length = 0
  userIds.length = 0
})

async function venueWith(slug: string, rules: ScheduleRules) {
  const [venue] = await useDatabase()
    .insert(venues)
    .values({
      slug,
      name: 'Кафе с расписанием',
      kind: 'cafe',
      description: 'Описание до сохранения.',
      status: 'draft',
      lastVerifiedAt: '2026-10-01T00:00:00.000Z',
    })
    .returning()
  venueIds.push(venue!.id)
  await saveSchedule(
    'venue',
    venue!.id,
    { rules, sourceUrl: SOURCE, verifiedAt: '2026-10-01' },
    { actor: 'editor', pageStatus: 'draft' },
  )
  return venue!
}

async function owner(venueId: string) {
  const [user] = await useDatabase()
    .insert(users)
    .values({ email: `owner-${venueId}@cafe.test`, name: 'Владелец' })
    .returning()
  userIds.push(user!.id)
  await useDatabase().insert(venueMembers).values({ venueId, userId: user!.id, role: 'owner' })
  return user!.id
}

async function editor() {
  const [user] = await useDatabase()
    .insert(users)
    .values({ email: `editor-${Date.now()}@k39.test`, name: 'Редактор', role: 'editor' })
    .returning()
  userIds.push(user!.id)
  return user!.id
}

async function storedRow(venueId: string) {
  const [row] = await useDatabase().select().from(schedules).where(eq(schedules.entityId, venueId))
  return row!
}

/** The `hours` a form sends after the person edits the loaded table. */
async function formHours(
  venueId: string,
  edit: (days: Awaited<ReturnType<typeof loadHoursForm>>['days']) => void = () => {},
) {
  const form = await loadHoursForm('venue', venueId)
  edit(form.days)
  return hoursPayload(form.days, form.note, { openEnded: true })
}

function keptRules(rules: ScheduleRules) {
  const { seasons: _seasons, ...rest } = rules
  return rest
}

describe('venue hours: the schedule is the only source (ADR 0028)', () => {
  it('keeps two seasons, a closure and an exception through an admin save and refuses a table write', async () => {
    const venue = await venueWith('hours-two-seasons-admin', twoSeasons)
    const before = await storedRow(venue.id)
    const userId = await editor()

    await updateVenue({ id: venue.id, description: 'Описание после правки редактора.' }, userId)
    const after = await storedRow(venue.id)
    expect(after.rules).toEqual(before.rules)
    expect(after.updatedAt).toBe(before.updatedAt)
    expect(after.verifiedAt).toBe('2026-10-01')

    const form = await loadHoursForm('venue', venue.id)
    expect(form.editable).toBe(false)
    expect(form.lines.length).toBeGreaterThan(0)
    form.days[0]!.opens = '08:00'
    await expect(
      updateVenue({ id: venue.id, hours: hoursPayload(form.days, form.note, { openEnded: true }) }, userId),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect((await storedRow(venue.id)).rules).toEqual(before.rules)
  })

  it('keeps two seasons through a cabinet description-only save and does not stamp the check date', async () => {
    const venue = await venueWith('hours-two-seasons-owner', twoSeasons)
    const before = await storedRow(venue.id)
    const userId = await owner(venue.id)

    await saveOwnerVenue(userId, venue.id, { description: 'Описание от владельца заведения.' })
    const after = await storedRow(venue.id)
    expect(after.rules).toEqual(before.rules)
    expect(after.updatedAt).toBe(before.updatedAt)
    const [row] = await useDatabase().select().from(venues).where(eq(venues.id, venue.id))
    expect(row!.description).toBe('Описание от владельца заведения.')
    expect(row!.lastVerifiedAt).toBe(venue.lastVerifiedAt)
  })

  it('replaces only Monday of the one season and keeps closures, exceptions, holidays, mode and source (editor)', async () => {
    const venue = await venueWith('hours-monday-editor', singleSeason)
    const userId = await editor()
    const hours = await formHours(venue.id, (days) => {
      days.find((day) => day.weekday === 'mon')!.opens = '08:00'
    })

    await updateVenue({ id: venue.id, hours }, userId)
    const stored = await loadSchedule('venue', venue.id)
    expect(keptRules(stored!.rules)).toEqual(keptRules(singleSeason))
    expect(stored!.rules.seasons).toEqual([
      {
        week: [
          { days: [1], opens: '08:00', closes: '19:00', breaks: [] },
          { days: [2, 3, 4, 5], opens: '10:00', closes: '19:00', breaks: [] },
        ],
        unknownDays: [0],
      },
    ])
    expect(stored!.sourceUrl).toBe(SOURCE)
    expect(stored!.verifiedAt).toBe('2026-10-01')
  })

  it('replaces only Monday for the owner and stamps the check date only then', async () => {
    const venue = await venueWith('hours-monday-owner', singleSeason)
    const userId = await owner(venue.id)

    await saveOwnerVenue(userId, venue.id, { description: 'Без смены часов.', hours: await formHours(venue.id) })
    expect((await storedRow(venue.id)).verifiedAt).toBe('2026-10-01')

    await saveOwnerVenue(userId, venue.id, {
      hours: await formHours(venue.id, (days) => {
        days.find((day) => day.weekday === 'mon')!.state = 'closed'
      }),
    })
    const stored = await loadSchedule('venue', venue.id)
    expect(keptRules(stored!.rules)).toEqual(keptRules(singleSeason))
    expect(stored!.rules.seasons[0]!.week).toEqual([
      { days: [2, 3, 4, 5], opens: '10:00', closes: '19:00', breaks: [] },
    ])
    expect(stored!.sourceUrl).toBe(SOURCE)
    expect(stored!.verifiedAt).not.toBe('2026-10-01')
    const [row] = await useDatabase().select().from(venues).where(eq(venues.id, venue.id))
    expect(row!.lastVerifiedAt).not.toBe(venue.lastVerifiedAt)
  })

  it('does not write the schedule when the table and the note are unchanged', async () => {
    const venue = await venueWith('hours-unchanged', singleSeason)
    const before = await storedRow(venue.id)
    const userId = await editor()

    await updateVenue({ id: venue.id, hours: await formHours(venue.id), lastVerifiedAt: '2026-10-01' }, userId)
    await updateVenue({ id: venue.id, hours: await formHours(venue.id) })
    const after = await storedRow(venue.id)
    expect(after.updatedAt).toBe(before.updatedAt)
    expect(after.rules).toEqual(before.rules)
  })

  it('fills the forms from schedule_set and ignores the legacy column', async () => {
    const venue = await venueWith('hours-from-schedule', singleSeason)
    await useDatabase()
      .update(venues)
      .set({
        hours: { note: 'Старая колонка', days: [{ weekday: 'mon', closed: false, opens: '00:00', closes: '01:00' }] },
      })
      .where(eq(venues.id, venue.id))
    const form = await loadHoursForm('venue', venue.id)
    expect(form.editable).toBe(true)
    expect(form.note).toBe('Кухня до 18:30')
    expect(form.days.find((day) => day.weekday === 'mon')).toEqual({
      weekday: 'mon',
      state: 'open',
      opens: '10:00',
      closes: '19:00',
    })
    expect(form.days.find((day) => day.weekday === 'sun')?.state).toBe('unknown')
    expect(form.days.find((day) => day.weekday === 'sat')?.state).toBe('closed')
  })

  it('clears the week when every day becomes closed and keeps the rest', async () => {
    const venue = await venueWith('hours-clear-week', singleSeason)
    const hours = await formHours(venue.id, (days) => {
      for (const day of days) {
        day.state = 'closed'
      }
    })
    await updateVenue({ id: venue.id, hours })
    const stored = await loadSchedule('venue', venue.id)
    expect(stored!.rules.seasons).toEqual([{ week: [] }])
    expect(keptRules(stored!.rules)).toEqual(keptRules(singleSeason))
  })

  it('creates the schedule from the table on venue_create', async () => {
    const created = await createVenue({
      name: 'Новое кафе с часами',
      kind: 'cafe',
      status: 'draft',
      hours: { note: null, days: [{ weekday: 'tue', closed: false, opens: '09:00', closes: '18:00' }] },
    })
    venueIds.push(created!.id)
    const stored = await loadSchedule('venue', created!.id)
    expect(stored!.rules.seasons).toEqual([{ week: [{ days: [2], opens: '09:00', closes: '18:00', breaks: [] }] }])
    expect(stored!.verifiedAt).toBeNull()
  })

  it('keeps the stored week when hours carry only a note, or nothing', async () => {
    const venue = await venueWith('hours-note-only', singleSeason)
    const before = await storedRow(venue.id)

    await updateVenue({ id: venue.id, hours: {} })
    expect((await storedRow(venue.id)).updatedAt).toBe(before.updatedAt)

    await updateVenue({ id: venue.id, hours: { note: 'Кухня до 18:00' } })
    const stored = await loadSchedule('venue', venue.id)
    expect(stored!.rules.seasons).toEqual(singleSeason.seasons)
    expect(stored!.rules.note).toBe('Кухня до 18:00')
    expect(keptRules({ ...stored!.rules, note: singleSeason.note })).toEqual(keptRules(singleSeason))

    const userId = await owner(venue.id)
    await saveOwnerVenue(userId, venue.id, { hours: { note: null } })
    const cleared = await loadSchedule('venue', venue.id)
    expect(cleared!.rules.seasons).toEqual(singleSeason.seasons)
    expect(cleared!.rules.note).toBeUndefined()
  })

  it('changes only the note of rules a table cannot show', async () => {
    const venue = await venueWith('hours-note-seasons', twoSeasons)
    await updateVenue({ id: venue.id, hours: { note: 'Летом терраса' } })
    const stored = await loadSchedule('venue', venue.id)
    expect({ ...stored!.rules, note: twoSeasons.note }).toEqual(twoSeasons)
    expect(stored!.rules.note).toBe('Летом терраса')
  })

  it('stores a note without a schedule as hours unknown on every day, never closed', async () => {
    const created = await createVenue({
      name: 'Кафе с заметкой',
      kind: 'cafe',
      status: 'draft',
      hours: { note: 'Работает по сезону' },
    })
    venueIds.push(created!.id)
    const stored = await loadSchedule('venue', created!.id)
    expect(stored!.rules.seasons).toEqual([{ week: [], unknownDays: [1, 2, 3, 4, 5, 6, 0] }])
    expect(stored!.rules.note).toBe('Работает по сезону')
  })

  it('refuses a note over the shared limit with a 400 and keeps the schedule', async () => {
    const venue = await venueWith('hours-long-note', singleSeason)
    const before = await storedRow(venue.id)
    const long = 'я'.repeat(HOURS_NOTE_MAX + 1)
    expect(() => normalizeHours({ note: long })).toThrow(VenueInputError)
    await expect(updateVenue({ id: venue.id, hours: { note: long, days: [] } })).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: HOURS_NOTE_TOO_LONG,
    })
    await expect(updateVenue({ id: venue.id, hours: { note: long } })).rejects.toMatchObject({ statusCode: 400 })
    const userId = await owner(venue.id)
    await expect(saveOwnerVenue(userId, venue.id, { hours: { note: long } })).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: HOURS_NOTE_TOO_LONG,
    })
    expect((await storedRow(venue.id)).updatedAt).toBe(before.updatedAt)
    const atLimit = normalizeHours({ note: 'я'.repeat(HOURS_NOTE_MAX), days: [] })
    expect(weeklyTableRules(atLimit)?.note).toHaveLength(HOURS_NOTE_MAX)
  })

  it('caps an unparsed OSM opening_hours note at the schedule limit', () => {
    const hours = parseOsmHours(`Mo-Fr 10:00-19:00; ${'по договорённости '.repeat(30)}`)
    expect(hours.note).toHaveLength(HOURS_NOTE_MAX)
    expect(rulesFromVenueHours(hours)?.note).toHaveLength(HOURS_NOTE_MAX)
    expect(parseOsmHours('по договорённости '.repeat(30)).note).toHaveLength(HOURS_NOTE_MAX)
  })

  it('stores OSM hours draft by draft and skips invalid input without stopping', async () => {
    const [long, open, good] = await useDatabase()
      .insert(venues)
      .values([
        { slug: 'hours-osm-long', name: 'Длинная заметка', kind: 'cafe', description: '', status: 'draft' },
        { slug: 'hours-osm-open', name: 'Нет времени', kind: 'cafe', description: '', status: 'draft' },
        { slug: 'hours-osm-good', name: 'Хорошие часы', kind: 'cafe', description: '', status: 'draft' },
      ])
      .returning()
    venueIds.push(long!.id, open!.id, good!.id)
    const skipped = await saveImportedHours([
      {
        id: long!.id,
        draft: { osmId: 'node/1', hours: { note: 'я'.repeat(HOURS_NOTE_MAX + 1), days: [] }, sources: [] },
      },
      { id: open!.id, draft: { osmId: 'node/3', hours: { days: [{ weekday: 'mon', closed: false }] }, sources: [] } },
      {
        id: good!.id,
        draft: {
          osmId: 'node/2',
          hours: parseOsmHours('Mo-Fr 09:00-18:00'),
          sources: [{ url: 'https://www.openstreetmap.org/node/2' }],
        },
      },
    ])
    expect(skipped).toEqual(['node/1', 'node/3'])
    expect(await loadSchedule('venue', long!.id)).toBeNull()
    expect(await loadSchedule('venue', open!.id)).toBeNull()
    const stored = await loadSchedule('venue', good!.id)
    expect(stored).toMatchObject({ sourceUrl: 'https://www.openstreetmap.org/node/2', verifiedAt: null })
    expect(stored!.rules.seasons[0]!.week).toEqual([
      { days: [1, 2, 3, 4, 5], opens: '09:00', closes: '18:00', breaks: [] },
    ])
  })

  it('fails the OSM import on a database error instead of skipping the draft', async () => {
    const [first, second] = await useDatabase()
      .insert(venues)
      .values([
        { slug: 'hours-osm-db-a', name: 'Сбой базы', kind: 'cafe', description: '', status: 'draft' },
        { slug: 'hours-osm-db-b', name: 'После сбоя', kind: 'cafe', description: '', status: 'draft' },
      ])
      .returning()
    venueIds.push(first!.id, second!.id)
    const outage = new Error('connection terminated')
    const save = vi.spyOn(Schedules, 'save').mockRejectedValueOnce(outage)
    try {
      await expect(
        saveImportedHours([
          { id: first!.id, draft: { osmId: 'node/4', hours: parseOsmHours('Mo-Fr 09:00-18:00'), sources: [] } },
          { id: second!.id, draft: { osmId: 'node/5', hours: parseOsmHours('Mo-Fr 09:00-18:00'), sources: [] } },
        ]),
      ).rejects.toBe(outage)
      expect(save).toHaveBeenCalledTimes(1)
    } finally {
      save.mockRestore()
    }
    expect(await loadSchedule('venue', second!.id)).toBeNull()
  })
})
