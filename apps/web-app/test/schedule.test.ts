import { describe, expect, it } from 'vitest'
import {
  availabilityFromWindow,
  availabilityText,
  dayStateOn,
  describeSchedule,
  expandIntervals,
  hoursOn,
  rulesFromText,
  rulesFromVenueHours,
  scheduleDetails,
  scheduleMarkup,
  scheduleRulesSchema,
  statusFromRules,
  unknownSpans,
} from '../shared/schedule'

const market = scheduleRulesSchema.parse({
  seasons: [{ week: [{ days: [0, 1, 2, 3, 4, 5, 6], opens: '08:00', closes: '19:00' }] }],
  closures: [{ weekday: 1, nth: -1, label: 'Санитарный день' }],
})
const record = { rules: market, sourceUrl: 'https://rynok39.ru', verifiedAt: '2026-10-13' }

// Kaliningrad is UTC+2 all year.
const at = (local: string) => new Date(`${local}:00+02:00`)

describe('schedule', () => {
  it('expands daily hours and skips the last Monday', () => {
    const days = expandIntervals(market, '2026-10-25', 3).map((item) => item.start.toISOString())
    expect(days).toEqual(['2026-10-25T06:00:00.000Z', '2026-10-27T06:00:00.000Z'])
  })

  it('reports open, closing soon, opening soon and closed', () => {
    expect(statusFromRules(record, at('2026-10-14T12:00')).status).toBe('open')
    expect(statusFromRules(record, at('2026-10-14T18:30')).status).toBe('closing_soon')
    expect(statusFromRules(record, at('2026-10-14T07:30')).status).toBe('opening_soon')
    expect(statusFromRules(record, at('2026-10-14T21:00')).status).toBe('closed')
    expect(availabilityText(statusFromRules(record, at('2026-10-14T21:00')), at('2026-10-14T21:00'))).toBe(
      'Закрыто, откроется завтра в 08:00',
    )
  })

  it('never says closed when unverified', () => {
    expect(statusFromRules({ ...record, verifiedAt: null }, at('2026-10-14T21:00')).status).toBe('unknown')
    expect(scheduleMarkup({ ...record, verifiedAt: null }, at('2026-10-14T12:00'))).toBeNull()
  })

  it('handles overnight intervals', () => {
    const bar = {
      rules: scheduleRulesSchema.parse({ seasons: [{ week: [{ days: [5], opens: '18:00', closes: '02:00' }] }] }),
      sourceUrl: null,
      verifiedAt: '2026-10-13',
    }
    expect(statusFromRules(bar, at('2026-10-17T01:00')).status).toBe('closing_soon')
  })

  it('reads the window from the availability query', () => {
    const value = availabilityFromWindow(
      { currentEnd: '2026-10-14T17:00:00.000Z', nextStart: null, verified: true },
      at('2026-10-14T12:00'),
    )
    expect(value.status).toBe('open')
    expect(value.minutesLeft).toBe(420)
  })

  it('migrates text and venue hours', () => {
    const rules = rulesFromText('Ежедневно 10:00–19:00, касса до 18:00')
    expect(rules?.seasons[0]?.week[0]).toMatchObject({ opens: '10:00', closes: '19:00', lastEntry: '18:00' })
    expect(
      rulesFromVenueHours({ days: [{ weekday: 'mon', closed: false, opens: '09:00', closes: '22:00' }], note: null })
        ?.seasons[0]?.week[0]?.days,
    ).toEqual([1])
    expect(describeSchedule(market).length).toBeGreaterThan(0)
  })
})

describe('long and 24/7 intervals', () => {
  const now = at('2026-10-14T03:00')
  it('24/7 rules have no closing time', () => {
    const park = { rules: scheduleRulesSchema.parse({ mode: 'always' }), sourceUrl: null, verifiedAt: '2026-10-14' }
    const value = statusFromRules(park, now)
    expect(value).toMatchObject({ status: 'open', closesAt: null, alwaysOpen: true })
    expect(availabilityText(value, now)).toBe('Доступно круглосуточно')
  })

  it('a window-boundary end is never a closing time', () => {
    const value = availabilityFromWindow(
      { currentEnd: '2026-10-28T22:00:00.000Z', nextStart: null, verified: true },
      now,
    )
    expect(value.closesAt).toBeNull()
    expect(availabilityText(value, now)).toBe('Доступно круглосуточно')
  })

  it('names the date instead of a day-plus countdown', () => {
    const value = availabilityFromWindow(
      { currentEnd: '2026-10-16T16:00:00.000Z', nextStart: null, verified: true },
      now,
    )
    expect(availabilityText(value, now)).toBe('Открыто до 16.10 18:00')
  })

  it('keeps the countdown under a day', () => {
    expect(availabilityText(statusFromRules(record, at('2026-10-14T17:00')), at('2026-10-14T17:00'))).toBe(
      'Открыто до 19:00 · ещё 2 ч',
    )
  })
})

describe('by appointment', () => {
  it('reads «По записи», never closed', () => {
    const fort = {
      rules: scheduleRulesSchema.parse({ mode: 'appointment', note: 'запись по телефону' }),
      sourceUrl: null,
      verifiedAt: '2026-10-14',
    }
    const now = at('2026-10-14T23:00')
    const value = statusFromRules(fort, now)
    expect(value.status).toBe('appointment')
    expect(availabilityText(value, now)).toBe('По записи')
    expect(
      availabilityFromWindow({ currentEnd: null, nextStart: null, verified: true, appointment: true }, now).status,
    ).toBe('appointment')
  })
})

describe('closed access', () => {
  it('names the reason and the outside view, never hours', async () => {
    const { closureText } = await import('../shared/schedule')
    const bastion = {
      rules: scheduleRulesSchema.parse({ mode: 'closed', closure: { reason: 'restoration', viewableOutside: true } }),
      sourceUrl: null,
      verifiedAt: '2026-10-14',
    }
    const now = at('2026-10-14T12:00')
    const value = statusFromRules(bastion, now)
    expect(value.status).toBe('closed')
    expect(availabilityText(value, now)).toBe('Закрыто на реставрацию · снаружи можно посмотреть')
    expect(closureText({ reason: 'repair', until: '2027-05-01', viewableOutside: false })).toBe(
      'Закрыто на ремонт до 01.05.2027',
    )
    expect(
      availabilityText(
        availabilityFromWindow({ currentEnd: null, nextStart: null, verified: true, closed: true }, now),
        now,
      ),
    ).toBe('Закрыто')
    expect(closureText({ reason: 'military', viewableOutside: false })).toBe('Закрыто: военный объект')
    expect(closureText({ reason: 'other', viewableOutside: true })).toBe('Закрыто · снаружи можно посмотреть')
  })

  it.each([
    { reason: 'other', viewableOutside: false, expected: 'Закрыто' },
    { reason: 'other', viewableOutside: true, expected: 'Закрыто · снаружи можно посмотреть' },
    {
      reason: 'other',
      until: '2027-05-01',
      viewableOutside: true,
      expected: 'Закрыто до 01.05.2027 · снаружи можно посмотреть',
    },
    { reason: 'restoration', viewableOutside: true, expected: 'Закрыто на реставрацию · снаружи можно посмотреть' },
    { reason: 'repair', until: '2027-05-01', viewableOutside: false, expected: 'Закрыто на ремонт до 01.05.2027' },
    { reason: 'military', viewableOutside: false, expected: 'Закрыто: военный объект' },
    { reason: 'private', viewableOutside: true, expected: 'Закрыто: частная территория · снаружи можно посмотреть' },
    {
      reason: 'season',
      until: '2027-05-01',
      viewableOutside: false,
      expected: 'Закрыто до начала сезона до 01.05.2027',
    },
  ])('keeps closed availability and SSR details for $expected', ({ expected, ...closure }) => {
    const rules = scheduleRulesSchema.parse({ mode: 'closed', closure })
    const schedule = { rules, sourceUrl: null, verifiedAt: '2026-10-14' }
    const now = at('2026-10-14T12:00')
    const status = statusFromRules(schedule, now)
    expect(status).toMatchObject({ status: 'closed', opensAt: null, closesAt: null, closure: rules.closure })
    expect(availabilityText(status, now)).toBe(expected)
    expect(scheduleDetails(rules)).toEqual([expected])
    expect(expandIntervals(rules, '2026-10-14', 7)).toEqual([])
  })
})

describe('slots', () => {
  const fringilla = {
    rules: scheduleRulesSchema.parse({
      mode: 'slots',
      seasons: [
        { from: '03-28', to: '10-31', week: [{ days: [0, 1, 2, 3, 4, 5, 6], opens: '09:00', closes: '18:00' }] },
      ],
      slots: { times: ['15:00', '16:00', '17:00'], minutes: 50 },
    }),
    sourceUrl: null,
    verifiedAt: '2026-10-14',
  }
  it('shows the next start, never open-until', () => {
    const noon = at('2026-10-14T12:00')
    expect(availabilityText(statusFromRules(fringilla, noon), noon)).toBe('Ближайшая экскурсия в 15:00')
    const during = at('2026-10-14T15:10')
    expect(availabilityText(statusFromRules(fringilla, during), during)).toBe('Ближайшая экскурсия в 16:00')
    const evening = at('2026-10-14T19:00')
    expect(availabilityText(statusFromRules(fringilla, evening), evening)).toBe('Ближайшая экскурсия завтра в 15:00')
  })
  it('has no next start after the season', () => {
    const late = at('2026-11-02T12:00')
    expect(availabilityText(statusFromRules(fringilla, late), late)).toBe('Ближайших сеансов нет')
    expect(describeSchedule(fringilla.rules)).toContain('Экскурсия: начало в 15:00, 16:00, 17:00')
  })
})

describe('server-rendered schedule details', () => {
  it('keeps the mode and note before live status hydrates', () => {
    const closed = scheduleRulesSchema.parse({
      mode: 'closed',
      note: 'Открытие планируется в 2028 году',
      closure: { reason: 'restoration', viewableOutside: true },
    })
    expect(scheduleDetails(closed)).toEqual(describeSchedule(closed))
    expect(scheduleDetails(scheduleRulesSchema.parse({ mode: 'closed' }))).toEqual(['Закрыто'])
    expect(scheduleDetails(scheduleRulesSchema.parse({ mode: 'appointment', note: 'запись по телефону' }))).toEqual([
      'По предварительной договорённости',
      'запись по телефону',
    ])
    expect(scheduleDetails(scheduleRulesSchema.parse({ mode: 'always' }))).toEqual(['Круглосуточно'])
    expect(
      scheduleDetails(
        scheduleRulesSchema.parse({
          mode: 'hours',
          seasons: [{ week: [{ days: [1, 2, 3, 4, 5], opens: '10:00', closes: '18:00' }] }],
        }),
      ).join(' '),
    ).toContain('10:00')
  })
})

describe('open-ended days (ADR 0042)', () => {
  const daily = scheduleRulesSchema.parse({ seasons: [{ week: [{ days: [0, 1, 2, 3, 4, 5, 6], opens: '12:00' }] }] })
  const villa = { rules: daily, sourceUrl: null, verifiedAt: '2026-10-14' }

  it('validates an entry without closes and checks its breaks and last entry', () => {
    expect(daily.seasons[0]?.week[0]?.closes).toBeUndefined()
    const day = (entry: Record<string, unknown>) =>
      scheduleRulesSchema.safeParse({ seasons: [{ week: [{ days: [1], opens: '12:00', ...entry }] }] }).success
    expect(day({ breaks: [{ from: '15:00', to: '16:00' }], lastEntry: '21:00' })).toBe(true)
    expect(day({ breaks: [{ from: '11:00', to: '12:30' }] })).toBe(false)
    expect(day({ breaks: [{ from: '16:00', to: '15:00' }] })).toBe(false)
    expect(day({ lastEntry: '01:00' })).toBe(false)
    expect(day({ closes: '02:00', lastEntry: '01:00' })).toBe(true)
  })

  it('expands to the end of the local day, flagged as open-ended', () => {
    expect(expandIntervals(daily, '2026-10-14', 2)).toEqual([
      {
        start: new Date('2026-10-14T10:00:00.000Z'),
        end: new Date('2026-10-14T22:00:00.000Z'),
        lastEntry: null,
        openEnded: true,
      },
      {
        start: new Date('2026-10-15T10:00:00.000Z'),
        end: new Date('2026-10-15T22:00:00.000Z'),
        lastEntry: null,
        openEnded: true,
      },
    ])
    const paused = scheduleRulesSchema.parse({
      seasons: [
        { week: [{ days: [3], opens: '12:00', breaks: [{ from: '15:00', to: '16:00' }], lastEntry: '21:00' }] },
      ],
    })
    expect(
      expandIntervals(paused, '2026-10-14', 1).map((item) => [
        item.start.toISOString(),
        item.end.toISOString(),
        item.lastEntry?.toISOString() ?? null,
        item.openEnded,
      ]),
    ).toEqual([
      ['2026-10-14T10:00:00.000Z', '2026-10-14T13:00:00.000Z', null, true],
      ['2026-10-14T14:00:00.000Z', '2026-10-14T22:00:00.000Z', '2026-10-14T19:00:00.000Z', true],
    ])
  })

  it('may say it opens at 12:00 before opening', () => {
    const now = at('2026-10-14T11:30')
    const value = statusFromRules(villa, now)
    expect(value).toMatchObject({ status: 'opening_soon', opensAt: '2026-10-14T10:00:00.000Z' })
    expect(availabilityText(value, now)).toBe('Закрыто, откроется сегодня в 12:00')
  })

  it('never says closed after opening that day, and never computes a close', () => {
    for (const time of ['12:00', '18:00', '23:30', '23:59']) {
      const now = at(`2026-10-14T${time}`)
      const value = statusFromRules(villa, now)
      expect(value).toMatchObject({
        status: 'open',
        openEnded: true,
        openedAt: '2026-10-14T10:00:00.000Z',
        closesAt: null,
        minutesLeft: null,
      })
      expect(availabilityText(value, now)).toBe('Открыто с 12:00, закрытие уточняйте')
    }
  })

  it('a break on an open-ended day never reads as closing soon', () => {
    const paused = {
      ...villa,
      rules: scheduleRulesSchema.parse({
        seasons: [{ week: [{ days: [3], opens: '12:00', breaks: [{ from: '15:00', to: '16:00' }] }] }],
      }),
    }
    expect(statusFromRules(paused, at('2026-10-14T14:30'))).toMatchObject({
      status: 'open',
      closesAt: null,
      minutesLeft: null,
    })
    expect(availabilityText(statusFromRules(paused, at('2026-10-14T16:30')), at('2026-10-14T16:30'))).toBe(
      'Открыто с 16:00, закрытие уточняйте',
    )
  })

  it('starts a new day after midnight', () => {
    const now = at('2026-10-15T00:30')
    const value = statusFromRules(villa, now)
    expect(value).toMatchObject({ status: 'closed', closesAt: null, opensAt: '2026-10-15T10:00:00.000Z' })
    expect(availabilityText(value, now)).toBe('Закрыто, откроется сегодня в 12:00')
  })

  it('stays unknown while unverified', () => {
    expect(statusFromRules({ ...villa, verifiedAt: null }, at('2026-10-14T13:00')).status).toBe('unknown')
  })

  it('reads the open-ended flag from the availability window', () => {
    const now = at('2026-10-14T23:00')
    const value = availabilityFromWindow(
      {
        currentEnd: '2026-10-14T22:00:00.000Z',
        currentStart: '2026-10-14T10:00:00.000Z',
        currentOpenEnded: true,
        nextStart: '2026-10-15T10:00:00.000Z',
        verified: true,
      },
      at('2026-10-14T19:00'),
    )
    expect(value).toMatchObject({ status: 'open', closesAt: null, minutesLeft: null, openEnded: true })
    expect(availabilityText(value, now)).toBe('Открыто с 12:00, закрытие уточняйте')
  })

  it('describes the day without a closing time', () => {
    expect(describeSchedule(daily)).toEqual(['Ежедневно с 12:00, закрытие уточняйте'])
    const mixed = scheduleRulesSchema.parse({
      seasons: [
        {
          week: [
            { days: [1, 2, 3, 4, 5], opens: '10:00', closes: '22:00' },
            { days: [0, 6], opens: '12:00', lastEntry: '21:00' },
          ],
        },
      ],
    })
    expect(describeSchedule(mixed)).toEqual([
      'Пн–пт 10:00–22:00; сб, вс с 12:00, вход и касса до 21:00, закрытие уточняйте',
    ])
    expect(scheduleDetails(daily)).toEqual(['Ежедневно с 12:00, закрытие уточняйте'])
  })

  it('emits no schema.org hours rather than an invented close', () => {
    expect(scheduleMarkup(villa, at('2026-10-14T12:00'))).toEqual({ regular: [], special: [] })
    const mixed = scheduleRulesSchema.parse({
      seasons: [
        {
          week: [
            { days: [1, 2, 3, 4, 5], opens: '10:00', closes: '22:00' },
            { days: [0, 6], opens: '12:00' },
          ],
        },
      ],
    })
    expect(scheduleMarkup({ ...villa, rules: mixed }, at('2026-10-14T12:00'))).toEqual({ regular: [], special: [] })
  })

  it('reads venue hours with an opening and no closing time', () => {
    const rules = rulesFromVenueHours({
      days: [
        { weekday: 'sat', closed: false, opens: '12:00', closes: null },
        { weekday: 'mon', closed: false, opens: '09:00', closes: '22:00' },
      ],
      note: null,
    })
    expect(rules?.seasons[0]?.week).toEqual([
      { days: [6], opens: '12:00', breaks: [] },
      { days: [1], opens: '09:00', closes: '22:00', breaks: [] },
    ])
  })
})

describe('days with unknown hours (ADR 0044)', () => {
  // 2026-10-16 is a Friday, 17 a Saturday, 18 a Sunday, 19 a Monday.
  const weekdays = scheduleRulesSchema.parse({
    seasons: [{ week: [{ days: [1, 2, 3, 4, 5], opens: '10:00', closes: '19:00' }], unknownDays: [6, 0] }],
  })
  const shop = { rules: weekdays, sourceUrl: null, verifiedAt: '2026-10-14' }
  const sundayOff = {
    ...shop,
    rules: scheduleRulesSchema.parse({
      seasons: [{ week: [{ days: [1, 2, 3, 4, 5], opens: '10:00', closes: '19:00' }], unknownDays: [6] }],
    }),
  }
  const plain = {
    ...shop,
    rules: scheduleRulesSchema.parse({
      seasons: [{ week: [{ days: [1, 2, 3, 4, 5], opens: '10:00', closes: '19:00' }] }],
    }),
  }
  const text = (record: typeof shop, local: string) => availabilityText(statusFromRules(record, at(local)), at(local))

  it('validates the list and rejects a day that also has hours', () => {
    expect(weekdays.seasons[0]?.unknownDays).toEqual([6, 0])
    const season = (unknownDays: number[]) =>
      scheduleRulesSchema.safeParse({
        seasons: [{ week: [{ days: [1, 2, 3, 4, 5], opens: '10:00', closes: '19:00' }], unknownDays }],
      }).success
    expect(season([6])).toBe(true)
    expect(season([5, 6])).toBe(false)
    expect(season([6, 6])).toBe(false)
    expect(season([7])).toBe(false)
    expect(scheduleRulesSchema.safeParse({ seasons: [{ week: [], unknownDays: [0, 1, 2, 3, 4, 5, 6] }] }).success).toBe(
      true,
    )
  })

  it('leaves stored rules without the field as they were', () => {
    expect(Object.keys(plain.rules.seasons[0]!)).toEqual(['week'])
    expect(dayStateOn(plain.rules, '2026-10-17')).toEqual({ kind: 'closed' })
    expect(describeSchedule(plain.rules)).toEqual(['Пн–пт 10:00–19:00; сб, вс выходные'])
    expect(text(plain, '2026-10-17T12:00')).toBe('Закрыто, откроется в понедельник в 10:00')
  })

  it('tells unknown from closed per day', () => {
    expect(dayStateOn(weekdays, '2026-10-16').kind).toBe('hours')
    expect(dayStateOn(weekdays, '2026-10-17')).toEqual({ kind: 'unknown' })
    expect(hoursOn(weekdays, '2026-10-17')).toBeNull()
    expect(dayStateOn(sundayOff.rules, '2026-10-18')).toEqual({ kind: 'closed' })
    const withRules = (extra: Record<string, unknown>) =>
      scheduleRulesSchema.parse({
        seasons: [{ week: [{ days: [1, 2, 3, 4, 5], opens: '10:00', closes: '19:00' }], unknownDays: [6, 0] }],
        ...extra,
      })
    // An exception or a recurring closure is stated by the source: it wins.
    expect(
      dayStateOn(
        withRules({ exceptions: [{ date: '2026-10-17', closed: false, opens: '11:00', closes: '15:00' }] }),
        '2026-10-17',
      ).kind,
    ).toBe('hours')
    expect(dayStateOn(withRules({ exceptions: [{ date: '2026-10-17' }] }), '2026-10-17').kind).toBe('closed')
    expect(dayStateOn(withRules({ closures: [{ weekday: 6, nth: 3 }] }), '2026-10-17').kind).toBe('closed')
    // 4 November is a public holiday on a Wednesday.
    expect(dayStateOn(withRules({ holidays: 'sunday' }), '2026-11-04').kind).toBe('unknown')
    expect(dayStateOn(withRules({ holidays: 'closed' }), '2026-11-04').kind).toBe('closed')
  })

  it('stores no interval for an unknown day and returns the days as spans', () => {
    expect(expandIntervals(weekdays, '2026-10-16', 4).map((item) => item.start.toISOString())).toEqual([
      '2026-10-16T08:00:00.000Z',
      '2026-10-19T08:00:00.000Z',
    ])
    expect(unknownSpans(weekdays, '2026-10-16', 4)).toEqual([
      { start: new Date('2026-10-16T22:00:00.000Z'), end: new Date('2026-10-18T22:00:00.000Z') },
    ])
    expect(unknownSpans(plain.rules, '2026-10-16', 4)).toEqual([])
    expect(
      unknownSpans(
        scheduleRulesSchema.parse({ mode: 'always', seasons: [{ week: [], unknownDays: [6] }] }),
        '2026-10-16',
        4,
      ),
    ).toEqual([])
  })

  it('reports open and closed on known days and unknown on unknown days', () => {
    expect(statusFromRules(shop, at('2026-10-14T12:00')).status).toBe('open')
    expect(statusFromRules(shop, at('2026-10-16T18:30')).status).toBe('closing_soon')
    expect(statusFromRules(shop, at('2026-10-15T21:00'))).toMatchObject({
      status: 'closed',
      opensAt: '2026-10-16T08:00:00.000Z',
    })
    for (const time of ['2026-10-17T00:00', '2026-10-17T12:00', '2026-10-18T23:30']) {
      expect(statusFromRules(shop, at(time))).toMatchObject({
        status: 'unknown',
        unknownDay: true,
        opensAt: null,
        closesAt: null,
      })
      expect(text(shop, time)).toBe('Сегодня часы уточняйте')
    }
    expect(statusFromRules(shop, at('2026-10-19T09:30'))).toMatchObject({
      status: 'opening_soon',
      opensAt: '2026-10-19T08:00:00.000Z',
    })
  })

  it('never names an opening across an unknown day', () => {
    const friday = at('2026-10-16T21:00')
    expect(statusFromRules(shop, friday)).toMatchObject({
      status: 'closed',
      opensAt: null,
      minutesToOpen: null,
      nextUnknown: true,
    })
    expect(text(shop, '2026-10-16T21:00')).toBe('Закрыто')
    expect(text(shop, '2026-10-16T23:30')).toBe('Закрыто')
    // A known day off followed by known hours still names the opening.
    expect(text(sundayOff, '2026-10-18T12:00')).toBe('Закрыто, откроется завтра в 10:00')
    expect(text(sundayOff, '2026-10-17T12:00')).toBe('Сегодня часы уточняйте')
  })

  it('keeps an overnight interval open into an unknown day until its close', () => {
    const bar = {
      ...shop,
      rules: scheduleRulesSchema.parse({
        seasons: [{ week: [{ days: [5], opens: '18:00', closes: '02:00' }], unknownDays: [6] }],
      }),
    }
    expect(statusFromRules(bar, at('2026-10-17T01:00'))).toMatchObject({
      status: 'closing_soon',
      closesAt: '2026-10-17T00:00:00.000Z',
    })
    expect(statusFromRules(bar, at('2026-10-17T03:00'))).toMatchObject({ status: 'unknown', unknownDay: true })
    expect(statusFromRules(bar, at('2026-10-16T17:30'))).toMatchObject({
      status: 'opening_soon',
      opensAt: '2026-10-16T16:00:00.000Z',
    })
  })

  it('stays unknown, not «today unknown», while unverified', () => {
    const value = statusFromRules({ ...shop, verifiedAt: null }, at('2026-10-16T12:00'))
    expect(value.status).toBe('unknown')
    expect(value.unknownDay).toBeUndefined()
  })

  it('reads unknown days next to the availability window', () => {
    const spans = unknownSpans(weekdays, '2026-10-15', 6)
    const saturday = availabilityFromWindow(
      { currentEnd: null, nextStart: '2026-10-19T08:00:00.000Z', verified: true, unknownDays: spans },
      at('2026-10-17T12:00'),
    )
    expect(saturday).toMatchObject({ status: 'unknown', unknownDay: true })
    const friday = availabilityFromWindow(
      { currentEnd: null, nextStart: '2026-10-19T08:00:00.000Z', verified: true, unknownDays: spans },
      at('2026-10-16T21:00'),
    )
    expect(friday).toMatchObject({ status: 'closed', opensAt: null, nextUnknown: true })
    const open = availabilityFromWindow(
      {
        currentEnd: '2026-10-16T17:00:00.000Z',
        nextStart: '2026-10-19T08:00:00.000Z',
        verified: true,
        unknownDays: spans,
      },
      at('2026-10-16T12:00'),
    )
    expect(open).toMatchObject({ status: 'open', closesAt: '2026-10-16T17:00:00.000Z' })
    const unverified = availabilityFromWindow(
      { currentEnd: null, nextStart: null, verified: false, unknownDays: spans },
      at('2026-10-17T12:00'),
    )
    expect(unverified.unknownDay).toBeUndefined()
  })

  it('names no slot across an unknown day', () => {
    const tours = {
      ...shop,
      rules: scheduleRulesSchema.parse({
        mode: 'slots',
        seasons: [{ week: [{ days: [1, 2, 3, 4, 5], opens: '09:00', closes: '18:00' }], unknownDays: [6, 0] }],
        slots: { times: ['15:00'] },
      }),
    }
    expect(text(tours, '2026-10-16T12:00')).toBe('Ближайшая экскурсия в 15:00')
    expect(text(tours, '2026-10-16T16:00')).toBe('Закрыто')
    expect(text(tours, '2026-10-17T12:00')).toBe('Сегодня часы уточняйте')
  })

  it('describes unknown days as «часы уточняйте», never «выходной»', () => {
    expect(describeSchedule(weekdays)).toEqual(['Пн–пт 10:00–19:00; сб, вс: часы уточняйте'])
    expect(scheduleDetails(weekdays)).toEqual(['Пн–пт 10:00–19:00; сб, вс: часы уточняйте'])
    expect(describeSchedule(sundayOff.rules)).toEqual(['Пн–пт 10:00–19:00; сб: часы уточняйте; вс выходной'])
    const midweek = scheduleRulesSchema.parse({
      seasons: [{ week: [{ days: [1, 5], opens: '10:00', closes: '19:00' }], unknownDays: [2, 3, 4] }],
    })
    expect(describeSchedule(midweek)).toEqual(['Пн, пт 10:00–19:00; вт–чт: часы уточняйте; сб, вс выходные'])
    expect(
      describeSchedule(scheduleRulesSchema.parse({ seasons: [{ week: [], unknownDays: [0, 1, 2, 3, 4, 5, 6] }] })),
    ).toEqual(['Часы уточняйте'])
    expect(describeSchedule(weekdays).join(' ')).not.toContain('выходн')
  })

  it('emits schema.org hours for known days only', () => {
    expect(scheduleMarkup(shop, at('2026-10-14T12:00'))).toEqual({
      regular: [
        {
          '@type': 'OpeningHoursSpecification',
          'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(
            (day) => `https://schema.org/${day}`,
          ),
          'opens': '10:00',
          'closes': '19:00',
        },
      ],
      special: [],
    })
  })

  it('reads venue hours with a day marked unknown', () => {
    const rules = rulesFromVenueHours({
      days: [
        { weekday: 'mon', closed: false, opens: '10:00', closes: '19:00' },
        { weekday: 'sat', closed: false, unknown: true, opens: null, closes: null },
        { weekday: 'sun', closed: true, opens: null, closes: null },
      ],
      note: null,
    })
    expect(rules?.seasons[0]).toEqual({
      week: [{ days: [1], opens: '10:00', closes: '19:00', breaks: [] }],
      unknownDays: [6],
    })
    expect(
      rulesFromVenueHours({
        days: [{ weekday: 'sat', closed: false, unknown: true, opens: null, closes: null }],
        note: null,
      }),
    ).toBeNull()
    expect(
      Object.keys(
        rulesFromVenueHours({ days: [{ weekday: 'mon', closed: false, opens: '10:00', closes: '19:00' }], note: null })!
          .seasons[0]!,
      ),
    ).toEqual(['week'])
  })
})
