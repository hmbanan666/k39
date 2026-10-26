// Weekly hours rows in the admin and owner venue forms. Both forms load the
// rows from the venue schedule (ADR 0028) and send them back only when a row
// or the note changed. The writer merges them into the one season they came
// from, so seasons, closures, exceptions and the source survive (ADR 0044:
// a day whose hours are unknown stays unknown).

import type { ScheduleRules } from './schedule'
import { describeSchedule, seasonFor, weeklyTableFits } from './schedule'

export const HOURS_WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export const HOURS_WEEKDAY_LABELS: Record<string, string> = {
  mon: 'пн',
  tue: 'вт',
  wed: 'ср',
  thu: 'чт',
  fri: 'пт',
  sat: 'сб',
  sun: 'вс',
}

const WEEKDAY_NUMBER: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

export type HoursDayState = 'open' | 'closed' | 'unknown'

export const HOURS_DAY_STATES: Array<{ value: HoursDayState; label: string }> = [
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

/** The hours block of a venue form, read from the stored schedule. */
export interface HoursFormState {
  days: HoursFormDay[]
  note: string
  /**
   * False when one weekly table cannot show the rules (several seasons, a
   * dated season, breaks, a mode other than `hours`). The form then shows
   * them read-only and never sends `hours`.
   */
  editable: boolean
  /** A season the table can show. False for 24/7, by appointment, closed, and events. */
  table: boolean
  /** The whole schedule in words, for the read-only view. */
  lines: string[]
}

export function blankHoursDays(): HoursFormDay[] {
  return HOURS_WEEKDAYS.map((weekday) => ({ weekday, state: 'closed', opens: '', closes: '' }))
}

/** A venue with no schedule yet: every day closed, editable. */
export function emptyHoursForm(): HoursFormState {
  return { days: blankHoursDays(), note: '', editable: true, table: true, lines: [] }
}

/**
 * Form rows from schedule rules. A read-only schedule fills the table from the
 * season that applies on `today` (Kaliningrad date).
 */
export function hoursFormState(rules: ScheduleRules | null, today: string): HoursFormState {
  const editable = weeklyTableFits(rules)
  const weekly = rules && (rules.mode === 'hours' || rules.mode === 'slots')
  const season = weekly ? (editable ? rules.seasons[0] : seasonFor(rules, today)) : undefined
  const days = blankHoursDays().map((day): HoursFormDay => {
    const number = WEEKDAY_NUMBER[day.weekday]!
    const entry = season?.week.find((item) => item.days.includes(number))
    if (entry) {
      return {
        weekday: day.weekday,
        state: 'open',
        opens: entry.opens,
        closes: entry.closes ?? '',
        ...(entry.closes ? {} : { openEnded: true }),
      }
    }
    return season?.unknownDays?.includes(number) ? { ...day, state: 'unknown' } : day
  })
  return {
    days,
    note: rules?.note ?? '',
    editable,
    table: !rules || Boolean(weekly),
    lines: editable ? [] : describeSchedule(rules),
  }
}

/**
 * Rows as weekday hours for the writer. `openEnded` lets any day keep an
 * opening time without a closing time (ADR 0042, admin). Otherwise only a day
 * loaded that way keeps it, and any other open day without both times is closed.
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

/** The `hours` field of a form save: the rows and the note. */
export function hoursPayload(days: HoursFormDay[], note: string, options: { openEnded: boolean }) {
  return { note: note.trim() || null, days: hoursDaysPayload(days, options) }
}
