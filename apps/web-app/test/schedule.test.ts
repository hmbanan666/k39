import { describe, expect, it } from 'vitest'
import { availabilityFromWindow, availabilityText, describeSchedule, expandIntervals, rulesFromText, rulesFromVenueHours, scheduleMarkup, scheduleRulesSchema, statusFromRules } from '../shared/schedule'

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
    expect(availabilityText(statusFromRules(record, at('2026-10-14T21:00')), at('2026-10-14T21:00'))).toBe('Закрыто, откроется завтра в 08:00')
  })

  it('never says closed when unverified', () => {
    expect(statusFromRules({ ...record, verifiedAt: null }, at('2026-10-14T21:00')).status).toBe('unknown')
    expect(scheduleMarkup({ ...record, verifiedAt: null }, at('2026-10-14T12:00'))).toBeNull()
  })

  it('handles overnight intervals', () => {
    const bar = { rules: scheduleRulesSchema.parse({ seasons: [{ week: [{ days: [5], opens: '18:00', closes: '02:00' }] }] }), sourceUrl: null, verifiedAt: '2026-10-13' }
    expect(statusFromRules(bar, at('2026-10-17T01:00')).status).toBe('closing_soon')
  })

  it('reads the window from the availability query', () => {
    const value = availabilityFromWindow({ currentEnd: '2026-10-14T17:00:00.000Z', nextStart: null, verified: true }, at('2026-10-14T12:00'))
    expect(value.status).toBe('open')
    expect(value.minutesLeft).toBe(420)
  })

  it('migrates text and venue hours', () => {
    const rules = rulesFromText('Ежедневно 10:00–19:00, касса до 18:00')
    expect(rules?.seasons[0]?.week[0]).toMatchObject({ opens: '10:00', closes: '19:00', lastEntry: '18:00' })
    expect(rulesFromVenueHours({ days: [{ weekday: 'mon', closed: false, opens: '09:00', closes: '22:00' }], note: null })?.seasons[0]?.week[0]?.days).toEqual([1])
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
    const value = availabilityFromWindow({ currentEnd: '2026-10-28T22:00:00.000Z', nextStart: null, verified: true }, now)
    expect(value.closesAt).toBeNull()
    expect(availabilityText(value, now)).toBe('Доступно круглосуточно')
  })

  it('names the date instead of a day-plus countdown', () => {
    const value = availabilityFromWindow({ currentEnd: '2026-10-16T16:00:00.000Z', nextStart: null, verified: true }, now)
    expect(availabilityText(value, now)).toBe('Открыто до 16.10 18:00')
  })

  it('keeps the countdown under a day', () => {
    expect(availabilityText(statusFromRules(record, at('2026-10-14T17:00')), at('2026-10-14T17:00'))).toBe('Открыто до 19:00 · ещё 2 ч')
  })
})

describe('by appointment', () => {
  it('reads «По записи», never closed', () => {
    const fort = { rules: scheduleRulesSchema.parse({ mode: 'appointment', note: 'запись по телефону' }), sourceUrl: null, verifiedAt: '2026-10-14' }
    const now = at('2026-10-14T23:00')
    const value = statusFromRules(fort, now)
    expect(value.status).toBe('appointment')
    expect(availabilityText(value, now)).toBe('По записи')
    expect(availabilityFromWindow({ currentEnd: null, nextStart: null, verified: true, appointment: true }, now).status).toBe('appointment')
  })
})

describe('temporarily closed', () => {
  it('names the reason and the outside view, never hours', async () => {
    const { closureText } = await import('../shared/schedule')
    const bastion = { rules: scheduleRulesSchema.parse({ mode: 'closed', closure: { reason: 'restoration', viewableOutside: true } }), sourceUrl: null, verifiedAt: '2026-10-14' }
    const now = at('2026-10-14T12:00')
    const value = statusFromRules(bastion, now)
    expect(value.status).toBe('closed')
    expect(availabilityText(value, now)).toBe('Закрыто на реставрацию · снаружи можно посмотреть')
    expect(closureText({ reason: 'repair', until: '2027-05-01', viewableOutside: false })).toBe('Закрыто на ремонт до 01.05.2027')
    expect(availabilityText(availabilityFromWindow({ currentEnd: null, nextStart: null, verified: true, closed: true }, now), now)).toBe('Временно закрыто')
  })
})
