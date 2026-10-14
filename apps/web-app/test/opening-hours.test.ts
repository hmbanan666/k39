import { describe, expect, it } from 'vitest'
import { nextClosureFact, openingHoursSchema, parsePlaceHours, upcomingClosures } from '../shared/opening-hours'
import { guideFacts } from '../shared/place-guide'

const MARKET = 'Ежедневно 8:00–19:00, последний понедельник месяца санитарный день'
const NOW = new Date('2026-10-14T08:00:00Z')

describe('opening hours', () => {
  it('reads a daily schedule with a monthly closed day', () => {
    expect(parsePlaceHours(MARKET)).toEqual({
      days: [1, 2, 3, 4, 5, 6, 0],
      opens: '08:00',
      closes: '19:00',
      monthlyClosure: { weekday: 1, which: 'last', label: 'Санитарный день' },
    })
  })

  it('reads ranges and a redundant weekly day off', () => {
    expect(parsePlaceHours('вт–вс 10:00–18:00, пн выходной')).toMatchObject({ days: [2, 3, 4, 5, 6, 0], monthlyClosure: null })
    expect(parsePlaceHours('ежедневно 10:00–18:00, пн выходной')).toBeNull()
  })

  it('leaves free text alone', () => {
    expect(parsePlaceHours('Круглосуточно, виллы смотрят снаружи')).toBeNull()
    expect(parsePlaceHours('Май–сентябрь ежедневно 10:00–19:00; октябрь–апрель вт–вс 10:00–18:00')).toBeNull()
  })

  it('lists the next closed days from today', () => {
    expect(upcomingClosures(parsePlaceHours(MARKET), NOW)).toEqual(['2026-10-26', '2026-11-30', '2026-12-28'])
    expect(upcomingClosures(parsePlaceHours(MARKET), new Date('2026-10-27T08:00:00Z'), 1)).toEqual(['2026-11-30'])
  })

  it('builds schema parts and the facts row', () => {
    const schema = openingHoursSchema(parsePlaceHours(MARKET), NOW)!
    expect(schema.regular[0]).toMatchObject({ opens: '08:00', closes: '19:00' })
    expect(schema.special[0]).toEqual({ '@type': 'OpeningHoursSpecification', 'validFrom': '2026-10-26', 'validThrough': '2026-10-26', 'opens': '00:00', 'closes': '00:00' })
    expect(nextClosureFact(MARKET, NOW)).toEqual({ label: 'Ближайший санитарный день', value: 'понедельник, 26 октября' })
    expect(guideFacts({ hours: MARKET }, NOW).map((row) => row.key)).toEqual(['hours', 'closed'])
  })

  it('ignores a last-entry note', () => {
    expect(parsePlaceHours('Ежедневно 10:00–19:00, касса до 18:00')?.closes).toBe('19:00')
    expect(parsePlaceHours('Ежедневно 10:00–19:00, касса до 18:00, последний понедельник месяца санитарный день')?.monthlyClosure?.weekday).toBe(1)
    expect(parsePlaceHours('Ежедневно 10:00–19:00, обед 13:00–14:00')).toBeNull()
  })
})
