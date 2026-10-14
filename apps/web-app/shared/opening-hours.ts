// Place opening hours as typed by editors, read into schema.org parts and a
// "next closed day" fact. Only whole, recognised strings are read: a main
// schedule, optionally followed by one closure note. Anything else is left
// as plain text and produces no markup.

export const WEEKDAYS_RU = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'] as const
const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const DAY_WORD: Record<string, number> = { понедельник: 1, вторник: 2, среду: 3, среда: 3, четверг: 4, пятницу: 5, пятница: 5, субботу: 6, суббота: 6, воскресенье: 0 }
const DAY_NAME = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
const MONTH_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

export interface ParsedHours {
  /** Weekdays 0..6 (Sunday first) with the same opening time. */
  days: number[]
  opens: string
  closes: string
  /** A monthly closed day, such as the last Monday of the month. */
  monthlyClosure: { weekday: number, which: 'first' | 'last', label: string } | null
}

function clock(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) {
    return null
  }
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour === 24 && minute === 0) {
    return '23:59'
  }
  if (hour > 23 || minute > 59) {
    return null
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function dayIndex(short: string) {
  return WEEKDAYS_RU.indexOf(short as (typeof WEEKDAYS_RU)[number])
}

function mainSchedule(text: string): Pick<ParsedHours, 'days' | 'opens' | 'closes'> | null {
  const match = /^(?:ежедневно|каждый день|без выходных|(пн|вт|ср|чт|пт|сб|вс)(?:-(пн|вт|ср|чт|пт|сб|вс))?)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(text)
  if (!match) {
    return null
  }
  const opens = clock(match[3]!)
  const closes = clock(match[4]!)
  if (!opens || !closes) {
    return null
  }
  let days = [1, 2, 3, 4, 5, 6, 0]
  if (match[1]) {
    const start = dayIndex(match[1])
    const end = match[2] ? dayIndex(match[2]) : start
    days = []
    for (let day = start; ; day = (day + 1) % 7) {
      days.push(day)
      if (day === end) {
        break
      }
    }
  }
  return { days, opens, closes }
}

const LAST_ENTRY = /^(?:касса|кассы|вход|вход и кассы)\s+до\s+\d{1,2}:\d{2}$/

function closureNote(text: string, days: number[]) {
  const monthly = /^(последний|последняя|первый|первая)\s+(\S+)\s+(?:каждого\s+)?месяца\s*(?:-\s*)?(санитарный день|выходной|закрыто)$/.exec(text)
  if (monthly) {
    const weekday = DAY_WORD[monthly[2]!]
    if (weekday === undefined) {
      return undefined
    }
    return { weekday, which: monthly[1]!.startsWith('послед') ? 'last' as const : 'first' as const, label: monthly[3] === 'санитарный день' ? 'Санитарный день' : 'Выходной' }
  }
  // "пн выходной" after a range that already leaves Monday out adds nothing.
  const weekly = /^(пн|вт|ср|чт|пт|сб|вс)\s+выходной$/.exec(text)
  if (weekly && !days.includes(dayIndex(weekly[1]!))) {
    return null
  }
  return undefined
}

/** Reads an hours string, or returns null when it is not a recognised shape. */
export function parsePlaceHours(raw: string | null | undefined): ParsedHours | null {
  const text = (raw || '').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase()
  if (!text) {
    return null
  }
  const [head, ...rest] = text.split(/\s*[,;]\s*/)
  const main = mainSchedule(head!)
  // Ticket-desk notes ("касса до 18:00") do not change the opening hours.
  const notes = rest.filter((note) => !LAST_ENTRY.test(note))
  if (!main || notes.length > 1) {
    return null
  }
  let monthlyClosure: ParsedHours['monthlyClosure'] = null
  if (notes.length) {
    const note = closureNote(notes[0]!, main.days)
    if (note === undefined) {
      return null
    }
    monthlyClosure = note
  }
  return { ...main, monthlyClosure }
}

function nthWeekday(year: number, month: number, weekday: number, which: 'first' | 'last') {
  if (which === 'first') {
    const first = new Date(Date.UTC(year, month, 1)).getUTCDay()
    return 1 + ((weekday - first + 7) % 7)
  }
  const lastDay = new Date(Date.UTC(year, month + 1, 0))
  return lastDay.getUTCDate() - ((lastDay.getUTCDay() - weekday + 7) % 7)
}

/** Today's calendar date in Kaliningrad, as UTC midnight. */
function localToday(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kaliningrad', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).split('-').map(Number)
  return Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!)
}

/** The next monthly closed days from today (inclusive), as YYYY-MM-DD. */
export function upcomingClosures(hours: ParsedHours | null, now: Date, count = 3): string[] {
  const rule = hours?.monthlyClosure
  if (!rule) {
    return []
  }
  const today = localToday(now)
  const start = new Date(today)
  const out: string[] = []
  for (let offset = 0; out.length < count && offset < count + 2; offset++) {
    const year = start.getUTCFullYear() + Math.floor((start.getUTCMonth() + offset) / 12)
    const month = (start.getUTCMonth() + offset) % 12
    const day = nthWeekday(year, month, rule.weekday, rule.which)
    const date = Date.UTC(year, month, day)
    if (date >= today) {
      out.push(new Date(date).toISOString().slice(0, 10))
    }
  }
  return out
}

/** «Санитарный день: понедельник, 26 октября» for the facts card. */
export function nextClosureFact(raw: string | null | undefined, now: Date) {
  const hours = parsePlaceHours(raw)
  const next = upcomingClosures(hours, now, 1)[0]
  if (!hours?.monthlyClosure || !next) {
    return null
  }
  const date = new Date(`${next}T00:00:00Z`)
  return { label: `Ближайший ${hours.monthlyClosure.label.toLowerCase()}`, value: `${DAY_NAME[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTH_GEN[date.getUTCMonth()]}` }
}

/** schema.org openingHoursSpecification plus closed special days. */
export function openingHoursSchema(hours: ParsedHours | null, now: Date) {
  if (!hours) {
    return null
  }
  const regular = {
    '@type': 'OpeningHoursSpecification',
    'dayOfWeek': hours.days.map((day) => `https://schema.org/${SCHEMA_DAYS[day]}`),
    'opens': hours.opens,
    'closes': hours.closes,
  }
  const special = upcomingClosures(hours, now).map((date) => ({
    '@type': 'OpeningHoursSpecification',
    'validFrom': date,
    'validThrough': date,
    'opens': '00:00',
    'closes': '00:00',
  }))
  return { regular: [regular], special }
}
