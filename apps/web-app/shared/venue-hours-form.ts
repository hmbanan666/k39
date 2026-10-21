// Weekly hours rows in the admin and owner venue forms. Both forms load and
// save `venues.hours` through these helpers, so a day whose hours are unknown
// (ADR 0044) survives a save that does not touch it.

export const HOURS_WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export type HoursDayState = 'open' | 'closed' | 'unknown'

export const HOURS_DAY_STATES: Array<{ value: HoursDayState, label: string }> = [
  { value: 'open', label: 'часы' },
  { value: 'closed', label: 'выходной' },
  { value: 'unknown', label: 'часы уточняйте' },
]

export interface HoursFormDay {
  weekday: string
  state: HoursDayState
  opens: string
  closes: string
  /** Loaded with an opening time and no closing time (ADR 0042). */
  openEnded?: boolean
}

interface StoredDay {
  weekday: string
  closed: boolean
  unknown?: boolean
  opens: string | null
  closes: string | null
}

export function blankHoursDays(): HoursFormDay[] {
  return HOURS_WEEKDAYS.map((weekday) => ({ weekday, state: 'closed', opens: '', closes: '' }))
}

export function hoursFormDays(hours: { days?: StoredDay[] | null } | null | undefined): HoursFormDay[] {
  return blankHoursDays().map((day) => {
    const found = hours?.days?.find((item) => item.weekday === day.weekday)
    if (!found) {
      return day
    }
    const state: HoursDayState = found.unknown && !found.closed ? 'unknown' : found.closed ? 'closed' : 'open'
    const openEnded = state === 'open' && Boolean(found.opens) && !found.closes
    return { weekday: day.weekday, state, opens: found.opens || '', closes: found.closes || '', ...(openEnded ? { openEnded } : {}) }
  })
}

/**
 * Rows as `venues.hours` days. `openEnded` lets any day keep an opening time
 * without a closing time (ADR 0042, admin). Otherwise only a day loaded that
 * way keeps it, and any other open day without both times is closed.
 */
export function hoursDaysPayload(days: HoursFormDay[], options: { openEnded: boolean }): StoredDay[] {
  return days.map((day) => {
    if (day.state === 'unknown') {
      return { weekday: day.weekday, closed: false, unknown: true, opens: null, closes: null }
    }
    // The admin writer rejects an open day without an opening time, so the editor sees the mistake.
    if (day.state === 'open' && (options.openEnded || (day.openEnded && day.opens && !day.closes))) {
      return { weekday: day.weekday, closed: false, opens: day.opens || null, closes: day.closes || null }
    }
    if (day.state === 'open' && day.opens && day.closes) {
      return { weekday: day.weekday, closed: false, opens: day.opens, closes: day.closes }
    }
    return { weekday: day.weekday, closed: true, opens: null, closes: null }
  })
}
