import { isCalendarDate } from '@k39/types/zone'
import { russianDay } from './place-guide'
import { addDays, localNow, zonedTime } from './schedule'

// Dated performances (ADR 0046). Times are read and printed in Europe/Kaliningrad.

export const EVENT_TITLE_MAX = 120
export const EVENT_SUBJECT_PAGE_LIMIT = 8
export const EVENT_MEMBER_PAGE_LIMIT = 12

const LOCAL_CLOCK = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/

export interface EventTiming {
  allDay: boolean
  /** Local `YYYY-MM-DDTHH:mm` for a clock event. */
  startsAt?: string | null
  endsAt?: string | null
  /** `YYYY-MM-DD` for a date-only event. */
  startsOn?: string | null
  endsOn?: string | null
}

/**
 * The stored instants. A date-only event starts at local midnight and ends at the
 * next local midnight after `endsOn`, or after `startsOn`. Returns a problem string
 * instead when the input does not fit.
 */
export function eventInstants(input: EventTiming): { startsAt: Date, endsAt: Date | null } | string {
  if (input.allDay) {
    if (input.startsAt || input.endsAt) {
      return 'Событие на весь день: startsOn и endsOn (YYYY-MM-DD), без времени'
    }
    const startsOn = input.startsOn?.trim() || ''
    const endsOn = input.endsOn?.trim() || ''
    if (!isCalendarDate(startsOn) || (endsOn && !isCalendarDate(endsOn))) {
      return 'Дата события: YYYY-MM-DD'
    }
    if (endsOn && endsOn < startsOn) {
      return 'endsOn раньше startsOn'
    }
    return { startsAt: zonedTime(startsOn, '00:00'), endsAt: zonedTime(addDays(endsOn || startsOn, 1), '00:00') }
  }
  if (input.startsOn || input.endsOn) {
    return 'Событие со временем: startsAt и endsAt (YYYY-MM-DDTHH:mm, время Калининграда)'
  }
  const start = LOCAL_CLOCK.exec(input.startsAt?.trim() || '')
  if (!start || !isCalendarDate(start[1]!) || !validClock(start[2]!)) {
    return 'Начало события: YYYY-MM-DDTHH:mm, время Калининграда'
  }
  const startsAt = zonedTime(start[1]!, start[2]!)
  if (!input.endsAt?.trim()) {
    return { startsAt, endsAt: null }
  }
  const end = LOCAL_CLOCK.exec(input.endsAt.trim())
  if (!end || !isCalendarDate(end[1]!) || !validClock(end[2]!)) {
    return 'Конец события: YYYY-MM-DDTHH:mm, время Калининграда'
  }
  const endsAt = zonedTime(end[1]!, end[2]!)
  if (endsAt.getTime() <= startsAt.getTime()) {
    return 'Конец события должен быть позже начала'
  }
  return { startsAt, endsAt }
}

function validClock(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return hour! < 24 && minute! < 60
}

/** The moment the event stops being upcoming: the end, or the start when there is no end. */
export function eventEnd(row: { startsAt: Date | string, endsAt: Date | string | null }) {
  return new Date(row.endsAt ?? row.startsAt)
}

export function eventUpcoming(row: { startsAt: Date | string, endsAt: Date | string | null, cancelledAt?: Date | string | null, expiredAt?: Date | string | null }, now = new Date()) {
  return !row.cancelledAt && !row.expiredAt && eventEnd(row).getTime() > now.getTime()
}

function localClock(at: Date) {
  const { date, minutes } = localNow(at)
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return { date, time: `${hh}:${mm}` }
}

/** The form value for a stored row: local clock, or local dates for a date-only event. */
export function eventFormTiming(row: { startsAt: Date | string, endsAt: Date | string | null, allDay: boolean }): EventTiming {
  const start = localClock(new Date(row.startsAt))
  if (row.allDay) {
    const last = row.endsAt ? addDays(localClock(new Date(row.endsAt)).date, -1) : start.date
    return { allDay: true, startsOn: start.date, endsOn: last === start.date ? null : last }
  }
  const end = row.endsAt ? localClock(new Date(row.endsAt)) : null
  return {
    allDay: false,
    startsAt: `${start.date}T${start.time}`,
    endsAt: end ? `${end.date}T${end.time}` : null,
  }
}

/** «24 октября 2026, 19:00». A date-only event prints the date, or the date range. */
export function eventWhen(row: { startsAt: Date | string, endsAt: Date | string | null, allDay: boolean }) {
  const timing = eventFormTiming(row)
  if (timing.allDay) {
    const first = russianDay(timing.startsOn)
    return timing.endsOn ? `${first} – ${russianDay(timing.endsOn)}` : first
  }
  const start = localClock(new Date(row.startsAt))
  return `${russianDay(start.date)}, ${start.time}`
}

function zonedWall(date: string, time: string) {
  return Date.parse(`${date}T${time}:00Z`)
}

function offsetStamp(at: Date) {
  const { date, time } = localClock(at)
  const offset = Math.round((zonedWall(date, time) - zonedTime(date, time).getTime()) / 60_000)
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return `${date}T${time}:00${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

export interface EventNodeInput {
  title: string
  startsAt: Date | string
  endsAt: Date | string | null
  allDay: boolean
  ticketUrl: string | null
}

/** schema.org `Event`. The ticket amounts are the subject's admission offers, not this node. */
export function eventNode(row: EventNodeInput, locationId: string, pageUrl: string) {
  const timing = eventFormTiming(row)
  const node: Record<string, unknown> = {
    '@type': 'Event',
    'name': row.title,
    'startDate': timing.allDay ? timing.startsOn : offsetStamp(new Date(row.startsAt)),
    'location': { '@id': locationId },
    'url': row.ticketUrl || pageUrl,
  }
  if (timing.allDay && timing.endsOn) {
    node.endDate = timing.endsOn
  } else if (!timing.allDay && row.endsAt) {
    node.endDate = offsetStamp(new Date(row.endsAt))
  }
  return node
}

const SHORT_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

export interface EventLine {
  id: string
  title: string
  /** Full local text, «24 октября 2026, 19:00». */
  when: string
  /** `datetime` of the `<time>` element: a local date, or an instant with offset. */
  datetime: string
  day: string
  month: string
  /** Local clock, or a date range for a multi-day date-only event. Null for one day without a clock. */
  detail: string | null
  ticketUrl: string | null
  subject?: { title: string, href: string } | null
}

export function eventLine(row: EventNodeInput & { id: string }, subject?: EventLine['subject']): EventLine {
  const timing = eventFormTiming(row)
  const start = localClock(new Date(row.startsAt))
  return {
    id: row.id,
    title: row.title,
    when: eventWhen(row),
    datetime: timing.allDay ? start.date : offsetStamp(new Date(row.startsAt)),
    day: String(Number(start.date.slice(8, 10))),
    month: SHORT_MONTHS[Number(start.date.slice(5, 7)) - 1] ?? '',
    detail: timing.allDay ? (timing.endsOn ? eventWhen(row) : null) : start.time,
    ticketUrl: row.ticketUrl,
    subject: subject ?? null,
  }
}
