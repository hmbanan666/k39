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

describe('always open', () => {
  it('says круглосуточно', () => {
    const park = { rules: scheduleRulesSchema.parse({ mode: 'always' }), sourceUrl: null, verifiedAt: '2026-10-14' }
    const now = at('2026-10-14T03:00')
    const value = statusFromRules(park, now)
    expect(value.status).toBe('open')
    expect(availabilityText(value, now)).toBe('Открыто круглосуточно')
  })
})
