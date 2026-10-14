import type { ScheduleRecord, ScheduleRules } from './schedule'
import { nextClosureFact } from './opening-hours'
import { isVerified, nextClosedFact, scheduleDetails } from './schedule'

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

// "2026-10-13" -> "13 октября 2026". Returns '' for anything that is not a calendar day.
export function russianDay(iso: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso?.trim() || '')
  if (!match) {
    return ''
  }
  const month = MONTHS[Number(match[2]) - 1]
  const day = Number(match[3])
  if (!month || day < 1 || day > 31) {
    return ''
  }
  return `${day} ${month} ${match[1]}`
}

export interface GuideFact {
  key: 'duration' | 'season' | 'hours' | 'closed' | 'price'
  label: string
  value: string
}

// The answer block rows, in reading order. Empty fields drop out, so the block can vanish.
function closureRow(hours: string | null | undefined, rules: ScheduleRules | null, now: Date): GuideFact[] {
  const fact = rules ? nextClosedFact(rules, now) : nextClosureFact(hours, now)
  return fact ? [{ key: 'closed', label: fact.label, value: fact.value }] : []
}

export function guideFacts(place: {
  visitDuration?: string | null
  bestTime?: string | null
  hours?: string | null
  schedule?: ScheduleRecord | null
  price?: string | null
}, now = new Date()): GuideFact[] {
  // A checked structured schedule wins over the free-text hours.
  const record = place.schedule ?? null
  const usable = record && isVerified(record) ? record.rules : null
  const hoursText = usable ? scheduleDetails(usable).join('. ') : place.hours?.trim() || ''
  const rows: GuideFact[] = [
    { key: 'duration', label: 'Сколько времени', value: place.visitDuration?.trim() || '' },
    { key: 'season', label: 'Когда ехать', value: place.bestTime?.trim() || '' },
    { key: 'hours', label: 'Часы', value: hoursText },
    ...closureRow(place.hours, usable, now),
    { key: 'price', label: 'Цена', value: place.price?.trim() || '' },
  ]
  return rows.filter((row) => row.value)
}
