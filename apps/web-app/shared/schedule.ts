import { z } from 'zod'
import { parsePlaceHours } from './opening-hours'

// One schedule primitive for every entity (ADR 0028). Rules are wall-clock
// times in Europe/Kaliningrad; intervals, status, text and schema.org markup
// are all derived here, on the server and in the browser alike.

export const SCHEDULE_TZ = 'Europe/Kaliningrad'
export const SCHEDULE_ENTITY_TYPES = ['place', 'venue', 'event', 'route_stop', 'offer'] as const
export type ScheduleEntityType = (typeof SCHEDULE_ENTITY_TYPES)[number]

const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
const monthDay = z.string().regex(/^(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/)

const daySchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  opens: clock,
  /** Equal to or before `opens` means the interval runs past midnight. */
  closes: clock,
  breaks: z.array(z.object({ from: clock, to: clock })).max(3).default([]),
  /** Ticket desk or last entry, if earlier than closing. */
  lastEntry: clock.optional(),
})

export const scheduleRulesSchema = z.object({
  mode: z.enum(['hours', 'always', 'appointment', 'closed', 'events']).default('hours'),
  seasons: z.array(z.object({
    from: monthDay.optional(),
    to: monthDay.optional(),
    week: z.array(daySchema).max(7),
  })).max(6).default([]),
  closures: z.array(z.object({
    weekday: z.number().int().min(0).max(6),
    /** 1..5, or -1 for the last one in the month. */
    nth: z.number().int().min(-1).max(5).refine((value) => value !== 0),
    label: z.string().trim().min(1).max(40).default('Санитарный день'),
  })).max(4).default([]),
  holidays: z.enum(['as-usual', 'closed', 'sunday']).default('as-usual'),
  exceptions: z.array(z.object({
    date: isoDate,
    closed: z.boolean().default(true),
    opens: clock.optional(),
    closes: clock.optional(),
    note: z.string().trim().max(80).optional(),
  })).max(60).default([]),
  occurrences: z.array(z.object({ start: localDateTime, end: localDateTime })).max(200).default([]),
  note: z.string().trim().max(200).optional(),
  /** Set when the rules still need checking against an official source. */
  needsCheck: z.boolean().default(false),
})

export type ScheduleRules = z.infer<typeof scheduleRulesSchema>
export type ScheduleDay = z.infer<typeof daySchema>

export interface ScheduleRecord {
  rules: ScheduleRules
  sourceUrl: string | null
  verifiedAt: string | null
}

export function readRules(value: unknown): ScheduleRules | null {
  const parsed = scheduleRulesSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** Verified rules can report open or closed; anything else is «unknown». */
export function isVerified(record: { rules: ScheduleRules | null, verifiedAt: string | null } | null) {
  return Boolean(record?.rules && record.verifiedAt && !record.rules.needsCheck)
}

// Fixed Russian public holidays (MM-DD). Government day transfers are entered as exceptions.
const RU_HOLIDAYS = new Set(['01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07', '01-08', '02-23', '03-08', '05-01', '05-09', '06-12', '11-04'])

const SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const ACC = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу']
const NAMES = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
const GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const ORDINAL: Record<string, string[]> = {
  '1': ['Первое воскресенье', 'Первый понедельник', 'Первый вторник', 'Первая среда', 'Первый четверг', 'Первая пятница', 'Первая суббота'],
  '2': ['Второе воскресенье', 'Второй понедельник', 'Второй вторник', 'Вторая среда', 'Второй четверг', 'Вторая пятница', 'Вторая суббота'],
  '3': ['Третье воскресенье', 'Третий понедельник', 'Третий вторник', 'Третья среда', 'Третий четверг', 'Третья пятница', 'Третья суббота'],
  '4': ['Четвёртое воскресенье', 'Четвёртый понедельник', 'Четвёртый вторник', 'Четвёртая среда', 'Четвёртый четверг', 'Четвёртая пятница', 'Четвёртая суббота'],
  '5': ['Пятое воскресенье', 'Пятый понедельник', 'Пятый вторник', 'Пятая среда', 'Пятый четверг', 'Пятая пятница', 'Пятая суббота'],
  '-1': ['Последнее воскресенье', 'Последний понедельник', 'Последний вторник', 'Последняя среда', 'Последний четверг', 'Последняя пятница', 'Последняя суббота'],
}
const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

// --- time zone helpers -------------------------------------------------------

function zoneParts(at: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHEDULE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at).map((part) => [part.type, part.value]))
  return parts as Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>
}

/** Local calendar date (YYYY-MM-DD) and minute of day in Kaliningrad. */
export function localNow(at: Date) {
  const parts = zoneParts(at)
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

/** A Kaliningrad wall-clock time as an absolute instant. */
export function zonedTime(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const guess = Date.UTC(year!, month! - 1, day!, hour!, minute!)
  const parts = zoneParts(new Date(guess))
  const asLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
  return new Date(guess - (asLocal - guess))
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

function toMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return hour! * 60 + minute!
}

// --- rules for one day -------------------------------------------------------

function inSeason(season: ScheduleRules['seasons'][number], date: string) {
  if (!season.from || !season.to) {
    return true
  }
  const md = date.slice(5)
  return season.from <= season.to ? md >= season.from && md <= season.to : md >= season.from || md <= season.to
}

function seasonFor(rules: ScheduleRules, date: string) {
  return rules.seasons.find((season) => season.from && season.to && inSeason(season, date))
    ?? rules.seasons.find((season) => !season.from || !season.to)
}

function closureOn(rules: ScheduleRules, date: string) {
  const day = weekday(date)
  const [year, month] = date.split('-').map(Number)
  const dom = Number(date.slice(8))
  const last = new Date(Date.UTC(year!, month!, 0)).getUTCDate()
  return rules.closures.find((rule) => rule.weekday === day && (rule.nth === -1 ? dom > last - 7 : Math.ceil(dom / 7) === rule.nth))
}

export interface DayHours {
  opens: string
  closes: string
  breaks: Array<{ from: string, to: string }>
  lastEntry?: string
}

/** Regular hours on a calendar day, or null when closed. Not for events. */
export function hoursOn(rules: ScheduleRules, date: string): DayHours | null {
  if (rules.mode === 'always') {
    return { opens: '00:00', closes: '00:00', breaks: [] }
  }
  if (rules.mode !== 'hours') {
    return null
  }
  const exception = rules.exceptions.find((item) => item.date === date)
  if (exception) {
    return exception.closed || !exception.opens || !exception.closes ? null : { opens: exception.opens, closes: exception.closes, breaks: [] }
  }
  if (closureOn(rules, date)) {
    return null
  }
  let day = weekday(date)
  if (RU_HOLIDAYS.has(date.slice(5))) {
    if (rules.holidays === 'closed') {
      return null
    }
    if (rules.holidays === 'sunday') {
      day = 0
    }
  }
  const entry = seasonFor(rules, date)?.week.find((item) => item.days.includes(day))
  return entry ? { opens: entry.opens, closes: entry.closes, breaks: entry.breaks ?? [], lastEntry: entry.lastEntry } : null
}

// --- materialised intervals ------------------------------------------------

export interface OpenInterval {
  start: Date
  end: Date
  lastEntry: Date | null
}

/** Concrete open intervals for `days` local days starting at `from`. */
export function expandIntervals(rules: ScheduleRules, from: string, days: number): OpenInterval[] {
  const out: OpenInterval[] = []
  if (rules.mode === 'events') {
    const until = addDays(from, days)
    for (const item of rules.occurrences) {
      const date = item.start.slice(0, 10)
      if (date >= from && date < until) {
        out.push({ start: zonedTime(date, item.start.slice(11)), end: zonedTime(item.end.slice(0, 10), item.end.slice(11)), lastEntry: null })
      }
    }
    return out.sort((a, b) => a.start.getTime() - b.start.getTime())
  }
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(from, offset)
    const hours = hoursOn(rules, date)
    if (!hours) {
      continue
    }
    const overnight = toMinutes(hours.closes) <= toMinutes(hours.opens)
    const endDate = overnight ? addDays(date, 1) : date
    let start = zonedTime(date, hours.opens)
    const end = zonedTime(endDate, hours.closes)
    const lastEntry = hours.lastEntry ? zonedTime(toMinutes(hours.lastEntry) < toMinutes(hours.opens) ? addDays(date, 1) : date, hours.lastEntry) : null
    for (const pause of [...hours.breaks].sort((a, b) => a.from.localeCompare(b.from))) {
      const pauseStart = zonedTime(date, pause.from)
      out.push({ start, end: pauseStart, lastEntry: null })
      start = zonedTime(date, pause.to)
    }
    out.push({ start, end, lastEntry })
  }
  // An always-open schedule is one long interval.
  if (rules.mode === 'always' && out.length) {
    return [{ start: out[0]!.start, end: out.at(-1)!.end, lastEntry: null }]
  }
  return out
}

// --- status ------------------------------------------------------------------

export type AvailabilityStatus = 'open' | 'closing_soon' | 'opening_soon' | 'closed' | 'appointment' | 'unknown'

export interface Availability {
  status: AvailabilityStatus
  closesAt: string | null
  opensAt: string | null
  minutesLeft: number | null
  minutesToOpen: number | null
  /** 24/7: no closing time exists, so closesAt stays null. */
  alwaysOpen?: boolean
}

export const SOON_MINUTES = 60

const BY_APPOINTMENT: Availability = { status: 'appointment', closesAt: null, opensAt: null, minutesLeft: null, minutesToOpen: null }

const ALWAYS_OPEN: Availability = { status: 'open', closesAt: null, opensAt: null, minutesLeft: null, minutesToOpen: null, alwaysOpen: true }

/** Status at `at` from sorted intervals. `verified` false always gives unknown. */
export function availabilityAt(intervals: OpenInterval[], at: Date, verified: boolean): Availability {
  const unknown: Availability = { status: 'unknown', closesAt: null, opensAt: null, minutesLeft: null, minutesToOpen: null }
  if (!verified) {
    return unknown
  }
  const now = at.getTime()
  const current = intervals.find((item) => item.start.getTime() <= now && now < item.end.getTime())
  // An interval that runs past a week only ends at the materialised window
  // boundary: there is no real closing time to show.
  if (current && current.end.getTime() - now > 7 * 24 * 60 * 60_000) {
    return ALWAYS_OPEN
  }
  if (current) {
    const minutesLeft = Math.round((current.end.getTime() - now) / 60_000)
    return { status: minutesLeft <= SOON_MINUTES ? 'closing_soon' : 'open', closesAt: current.end.toISOString(), opensAt: null, minutesLeft, minutesToOpen: null }
  }
  const next = intervals.find((item) => item.start.getTime() > now)
  if (!next) {
    return { ...unknown, status: 'closed' }
  }
  const minutesToOpen = Math.round((next.start.getTime() - now) / 60_000)
  return { status: minutesToOpen <= SOON_MINUTES ? 'opening_soon' : 'closed', closesAt: null, opensAt: next.start.toISOString(), minutesLeft: null, minutesToOpen }
}

function clockOf(iso: string) {
  const parts = zoneParts(new Date(iso))
  return `${parts.hour}:${parts.minute}`
}

/** «Открыто до 19:00 · ещё 2 ч», «Закрыто, откроется завтра в 10:00». */
export function availabilityText(value: Availability, at: Date) {
  if (value.status === 'unknown') {
    return ''
  }
  if (value.alwaysOpen) {
    return 'Доступно круглосуточно'
  }
  if (value.status === 'appointment') {
    return 'По записи'
  }
  if (value.closesAt) {
    const left = value.minutesLeft ?? 0
    // Never show a day-plus countdown: name the closing date instead.
    if (left >= 24 * 60) {
      const parts = zoneParts(new Date(value.closesAt))
      return `Открыто до ${parts.day}.${parts.month} ${parts.hour}:${parts.minute}`
    }
    const rest = left >= 60 ? `ещё ${Math.floor(left / 60)} ч${left % 60 ? ` ${left % 60} мин` : ''}` : `ещё ${left} мин`
    return `Открыто до ${clockOf(value.closesAt)} · ${rest}`
  }
  if (!value.opensAt) {
    return 'Закрыто'
  }
  const today = localNow(at).date
  const openDay = localNow(new Date(value.opensAt)).date
  const when = openDay === today ? 'сегодня' : openDay === addDays(today, 1) ? 'завтра' : ACC[weekday(openDay)]
  return `Закрыто, откроется ${when} в ${clockOf(value.opensAt)}`
}

/** Browser-side status straight from rules, for one page. */
export function statusFromRules(record: { rules: ScheduleRules | null, verifiedAt: string | null } | null, at: Date): Availability {
  if (!record?.rules || !isVerified(record)) {
    return availabilityAt([], at, false)
  }
  if (record.rules.mode === 'always') {
    return ALWAYS_OPEN
  }
  // By appointment is neither open nor closed: never «Закрыто».
  if (record.rules.mode === 'appointment') {
    return BY_APPOINTMENT
  }
  const today = localNow(at).date
  return availabilityAt(expandIntervals(record.rules, addDays(today, -1), 16), at, true)
}

// --- text and markup ---------------------------------------------------------

function dayRange(days: number[]) {
  const ordered = WEEK_ORDER.filter((day) => days.includes(day))
  if (ordered.length === 7) {
    return 'ежедневно'
  }
  const runs: number[][] = []
  for (const day of ordered) {
    const run = runs.at(-1)
    if (run && WEEK_ORDER.indexOf(run.at(-1)!) === WEEK_ORDER.indexOf(day) - 1) {
      run.push(day)
    } else {
      runs.push([day])
    }
  }
  return runs.map((run) => run.length > 2 ? `${SHORT[run[0]!]}–${SHORT[run.at(-1)!]}` : run.map((day) => SHORT[day]).join(', ')).join(', ')
}

function mdLabel(value: string) {
  const [month, day] = value.split('-').map(Number)
  return `${day} ${GEN[month! - 1]}`
}

function dayLine(entry: ScheduleDay) {
  const parts = [`${dayRange(entry.days)} ${entry.opens}–${entry.closes}`]
  for (const pause of entry.breaks ?? []) {
    parts.push(`перерыв ${pause.from}–${pause.to}`)
  }
  if (entry.lastEntry) {
    parts.push(`вход и касса до ${entry.lastEntry}`)
  }
  return parts.join(', ')
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Human schedule lines, one per season and rule. */
export function describeSchedule(rules: ScheduleRules | null): string[] {
  if (!rules) {
    return []
  }
  const lines: string[] = []
  if (rules.mode === 'always') {
    lines.push('Круглосуточно')
  } else if (rules.mode === 'appointment') {
    lines.push('По предварительной договорённости')
  } else if (rules.mode === 'closed') {
    lines.push('Закрыто')
  } else if (rules.mode === 'hours') {
    for (const season of rules.seasons) {
      const open = new Set(season.week.flatMap((entry) => entry.days))
      const off = WEEK_ORDER.filter((day) => !open.has(day))
      let text = season.week.length ? season.week.map(dayLine).join('; ') : 'закрыто'
      if (season.week.length && off.length) {
        text += `; ${off.map((day) => SHORT[day]).join(', ')} ${off.length > 1 ? 'выходные' : 'выходной'}`
      }
      lines.push(season.from && season.to ? `С ${mdLabel(season.from)} по ${mdLabel(season.to)}: ${text}` : capitalize(text))
    }
    for (const rule of rules.closures) {
      lines.push(`${ORDINAL[String(rule.nth)]![rule.weekday]} месяца: ${rule.label.toLowerCase()}, закрыто`)
    }
    if (rules.holidays === 'closed') {
      lines.push('В государственные праздники закрыто')
    }
    if (rules.holidays === 'sunday') {
      lines.push('В праздники как в воскресенье')
    }
  }
  if (rules.note) {
    lines.push(rules.note)
  }
  return lines
}

/** Closed days from closures and exceptions, from today, as YYYY-MM-DD. */
export function upcomingClosedDays(rules: ScheduleRules | null, at: Date, count = 3, horizon = 120) {
  if (!rules || rules.mode !== 'hours') {
    return []
  }
  const start = localNow(at).date
  const out: Array<{ date: string, label: string }> = []
  for (let offset = 0; offset <= horizon && out.length < count; offset++) {
    const date = addDays(start, offset)
    const exception = rules.exceptions.find((item) => item.date === date && item.closed)
    const rule = closureOn(rules, date)
    if (exception || rule) {
      out.push({ date, label: exception?.note || rule?.label || 'Закрыто' })
    }
  }
  return out
}

/** «Ближайший санитарный день: понедельник, 26 октября». */
export function nextClosedFact(rules: ScheduleRules | null, at: Date) {
  const next = upcomingClosedDays(rules, at, 1)[0]
  if (!next) {
    return null
  }
  const date = new Date(`${next.date}T00:00:00Z`)
  return { label: `Ближайший ${next.label.toLowerCase()}`, value: `${NAMES[date.getUTCDay()]}, ${date.getUTCDate()} ${GEN[date.getUTCMonth()]}` }
}

function seasonBounds(season: ScheduleRules['seasons'][number], today: string) {
  if (!season.from || !season.to) {
    return {}
  }
  const year = Number(today.slice(0, 4))
  const wraps = season.from > season.to
  let from = `${year}-${season.from}`
  let to = `${wraps ? year + 1 : year}-${season.to}`
  if (to < today) {
    from = `${year + 1}-${season.from}`
    to = `${wraps ? year + 2 : year + 1}-${season.to}`
  }
  return { validFrom: from, validThrough: to }
}

/** schema.org opening hours; null for unverified or non-weekly schedules. */
export function scheduleMarkup(record: { rules: ScheduleRules | null, verifiedAt: string | null } | null, at: Date) {
  if (!record?.rules || !isVerified(record)) {
    return null
  }
  const rules = record.rules
  const today = localNow(at).date
  if (rules.mode === 'always') {
    return { regular: [{ '@type': 'OpeningHoursSpecification', 'dayOfWeek': SCHEMA_DAYS.map((day) => `https://schema.org/${day}`), 'opens': '00:00', 'closes': '23:59' }], special: [] }
  }
  if (rules.mode !== 'hours' || !rules.seasons.length) {
    return null
  }
  const regular = rules.seasons.flatMap((season) => season.week.map((entry) => ({
    '@type': 'OpeningHoursSpecification',
    'dayOfWeek': entry.days.map((day) => `https://schema.org/${SCHEMA_DAYS[day]}`),
    'opens': entry.opens,
    'closes': entry.closes,
    ...seasonBounds(season, today),
  })))
  const special = [
    ...upcomingClosedDays(rules, at, 3).map((item) => ({ '@type': 'OpeningHoursSpecification', 'validFrom': item.date, 'validThrough': item.date, 'opens': '00:00', 'closes': '00:00' })),
    ...rules.exceptions.filter((item) => item.date >= today && !item.closed && item.opens && item.closes).map((item) => ({ '@type': 'OpeningHoursSpecification', 'validFrom': item.date, 'validThrough': item.date, 'opens': item.opens, 'closes': item.closes })),
  ]
  return { regular, special }
}

// --- migration from older shapes ---------------------------------------------

/** A recognised `places.hours` string as rules, or null. */
export function rulesFromText(text: string | null | undefined): ScheduleRules | null {
  const parsed = parsePlaceHours(text)
  if (!parsed) {
    return null
  }
  const lastEntry = /(?:касса|кассы|вход)[^,;]*?до\s+(\d{1,2}:\d{2})/i.exec(text || '')?.[1]
  return scheduleRulesSchema.parse({
    seasons: [{ week: [{ days: parsed.days, opens: parsed.opens, closes: parsed.closes === '23:59' ? '00:00' : parsed.closes, ...(lastEntry ? { lastEntry: lastEntry.padStart(5, '0') } : {}) }] }],
    closures: parsed.monthlyClosure ? [{ weekday: parsed.monthlyClosure.weekday, nth: parsed.monthlyClosure.which === 'last' ? -1 : 1, label: parsed.monthlyClosure.label }] : [],
  })
}

const VENUE_DAY: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

/** OSM-style venue hours as rules (unverified until checked). */
export function rulesFromVenueHours(hours: { days: Array<{ weekday: string, closed: boolean, opens: string | null, closes: string | null }>, note: string | null } | null): ScheduleRules | null {
  const open = (hours?.days ?? []).filter((day) => !day.closed && day.opens && day.closes && VENUE_DAY[day.weekday] !== undefined)
  if (!open.length) {
    return null
  }
  const groups = new Map<string, number[]>()
  for (const day of open) {
    const key = `${day.opens}|${day.closes}`
    groups.set(key, [...(groups.get(key) ?? []), VENUE_DAY[day.weekday]!])
  }
  const parsed = scheduleRulesSchema.safeParse({
    seasons: [{ week: [...groups].map(([key, days]) => {
      const [opens, closes] = key.split('|')
      return { days, opens: opens === '24:00' ? '00:00' : opens, closes: closes === '24:00' ? '00:00' : closes }
    }) }],
    note: hours?.note || undefined,
  })
  return parsed.success ? parsed.data : null
}

/** Status from the materialised window: the interval open at `at`, if any, and the next start. */
export function availabilityFromWindow(input: { currentEnd: string | null, nextStart: string | null, verified: boolean, alwaysOpen?: boolean, appointment?: boolean }, at: Date): Availability {
  if (input.verified && input.appointment) {
    return BY_APPOINTMENT
  }
  if (input.verified && input.alwaysOpen) {
    return ALWAYS_OPEN
  }
  const intervals: OpenInterval[] = []
  if (input.currentEnd) {
    intervals.push({ start: new Date(at.getTime() - 1), end: new Date(input.currentEnd), lastEntry: null })
  }
  if (input.nextStart) {
    intervals.push({ start: new Date(input.nextStart), end: new Date(new Date(input.nextStart).getTime() + 60_000), lastEntry: null })
  }
  return availabilityAt(intervals, at, input.verified)
}
