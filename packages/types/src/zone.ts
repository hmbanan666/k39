// Wall-clock helpers for Europe/Kaliningrad (ADR 0028). The schedule reader,
// the ADR 0046 event writer, and the seed fixtures share them.

export const SCHEDULE_TZ = 'Europe/Kaliningrad'

export function zoneParts(at: Date) {
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

/** A real `YYYY-MM-DD` calendar day: `2026-02-30` and `2026-13-01` are not. */
export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
