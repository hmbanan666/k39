import { createError } from 'h3'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

function calendarDay(year: number, month: number, day: number) {
  const probe = new Date(Date.UTC(year, month - 1, day))
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
}

// undefined keeps the stored timestamp. null clears it. A date-only value is UTC midnight.
export function parseFactsCheckedAt(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  if (typeof value !== 'string' || !ISO_DATE.test(value.trim())) {
    throw createError({ statusCode: 400, statusMessage: 'factsCheckedAt: нужна дата ISO' })
  }
  const trimmed = value.trim()
  const match = ISO_DATE.exec(trimmed)
  if (!match) {
    throw createError({ statusCode: 400, statusMessage: 'factsCheckedAt: нужна дата ISO' })
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!calendarDay(year, month, day)) {
    throw createError({ statusCode: 400, statusMessage: 'factsCheckedAt: нужна дата ISO' })
  }
  const hour = match[4] == null ? 0 : Number(match[4])
  const minute = match[5] == null ? 0 : Number(match[5])
  const second = match[6] == null ? 0 : Number(match[6])
  if (hour > 23 || minute > 59 || second > 59) {
    throw createError({ statusCode: 400, statusMessage: 'factsCheckedAt: нужна дата ISO' })
  }
  const date = match[4] == null
    ? new Date(Date.UTC(year, month - 1, day))
    : new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'factsCheckedAt: нужна дата ISO' })
  }
  return date.toISOString()
}
