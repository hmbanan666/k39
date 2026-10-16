import { db } from '@k39/database'

// Public pages read phone, address, coordinates, and operating status from
// facts (ADR 0033 phase 2). Hours stay on schedules. One batch per subject list.

/** What a gap fact shows. Schema markup omits it. */
export const FACT_UNKNOWN = 'уточняйте'

const READ_KINDS = ['phone', 'address', 'coordinates', 'status'] as const

const PLACE_STATUS = new Set(['open', 'ruins', 'closed', 'unknown'])

export interface FactColumns {
  phone?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  /** Place visit status, or the venue publication status. */
  status?: string | null
}

export interface CitedFact {
  path: string
  kind: string
  slot: string
  value: unknown
  confidence: string
  subjectType: string
  subjectId: string
}

export interface ShownFacts {
  phone: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  /**
   * Place: open, ruins, closed, or unknown.
   * Venue: `closed` when the place is operating closed, otherwise null.
   */
  status: string | null
  /** A status fact exists and its confidence is gap. */
  statusGap: boolean
}

/**
 * Text an editor should load. A cited fact wins. A gap keeps the column so
 * the form does not save the word «уточняйте» over a stored number.
 */
export function shownText(shown: string | null | undefined, column: string | null | undefined) {
  const text = shown?.trim() || ''
  if (!text || text === FACT_UNKNOWN) {
    return column?.trim() || null
  }
  return text
}

/** Drop the gap word from JSON-LD and meta text. */
export function omitFactGap(value: string | null | undefined) {
  const text = value?.trim() || ''
  return text && text !== FACT_UNKNOWN ? text : null
}

/**
 * Resolve one subject. `cited` is the fact_refs batch for that consumer.
 * A missing kind uses the column. A gap does not.
 */
export function projectShownFacts(subject: 'place' | 'venue', subjectId: string, columns: FactColumns, cited: CitedFact[]): ShownFacts {
  const phone = textField(pick(cited, 'phone', subject, subjectId), columns.phone)
  const address = textField(pick(cited, 'address', subject, subjectId), columns.address)
  const point = pointField(pick(cited, 'coordinates', subject, subjectId), columns.latitude, columns.longitude)
  const status = statusField(subject, pick(cited, 'status', subject, subjectId), columns.status)
  return { phone, address, latitude: point.latitude, longitude: point.longitude, ...status }
}

/** One query for every id. Callers share this instead of reading columns themselves. */
export async function readShownFacts(subject: 'place' | 'venue', rows: Array<FactColumns & { id: string }>) {
  const ids = [...new Set(rows.map((row) => row.id))]
  const cited = ids.length ? await db.facts.forConsumers(subject, ids, READ_KINDS) : []
  const byConsumer = new Map<string, CitedFact[]>()
  for (const row of cited) {
    const list = byConsumer.get(row.consumerId) ?? []
    list.push(row)
    byConsumer.set(row.consumerId, list)
  }
  const shown = new Map<string, ShownFacts>()
  for (const row of rows) {
    shown.set(row.id, projectShownFacts(subject, row.id, row, byConsumer.get(row.id) ?? []))
  }
  return shown
}

/** A map pin. Closed venues and gap coordinates are absent. */
export function pinCoordinates(subject: 'place' | 'venue', shown: ShownFacts) {
  if (subject === 'venue' && shown.status === 'closed') {
    return null
  }
  if (shown.latitude == null || shown.longitude == null) {
    return null
  }
  return { latitude: shown.latitude, longitude: shown.longitude }
}

function pick(rows: CitedFact[], kind: string, subject: string, subjectId: string) {
  let best: CitedFact | undefined
  let bestScore = -1
  for (const row of rows) {
    if (row.kind !== kind) {
      continue
    }
    const score = (row.path === `short.${kind}` ? 2 : 0) + (row.subjectType === subject && row.subjectId === subjectId ? 1 : 0)
    if (score > bestScore) {
      best = row
      bestScore = score
    }
  }
  return best
}

function textField(fact: CitedFact | undefined, column: string | null | undefined) {
  if (!fact) {
    return column?.trim() || null
  }
  if (fact.confidence === 'gap') {
    return FACT_UNKNOWN
  }
  const value = fact.value
  if (!value || typeof value !== 'object' || !('text' in value) || typeof value.text !== 'string') {
    return null
  }
  return value.text.trim() || null
}

function pointField(fact: CitedFact | undefined, latitude: number | null | undefined, longitude: number | null | undefined) {
  if (!fact) {
    return validPoint(latitude, longitude)
  }
  if (fact.confidence === 'gap') {
    return { latitude: null, longitude: null }
  }
  const value = fact.value
  if (!value || typeof value !== 'object') {
    return { latitude: null, longitude: null }
  }
  const record = value as { latitude?: unknown, longitude?: unknown }
  return validPoint(asNumber(record.latitude), asNumber(record.longitude))
}

function statusField(subject: 'place' | 'venue', fact: CitedFact | undefined, column: string | null | undefined) {
  if (!fact) {
    if (subject === 'venue') {
      return { status: column === 'closed' ? 'closed' : null, statusGap: false }
    }
    return { status: placeCode(column) ?? 'unknown', statusGap: false }
  }
  if (fact.confidence === 'gap') {
    return subject === 'place'
      ? { status: 'unknown', statusGap: true }
      : { status: null, statusGap: true }
  }
  const code = statusCode(subject, fact.value)
  if (subject === 'place') {
    return { status: code ?? 'unknown', statusGap: false }
  }
  return { status: code === 'closed' ? 'closed' : null, statusGap: false }
}

function statusCode(subject: 'place' | 'venue', value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as { scope?: unknown, status?: unknown }
  if (record.scope !== subject || typeof record.status !== 'string') {
    return null
  }
  if (subject === 'venue') {
    return record.status === 'open' || record.status === 'closed' ? record.status : null
  }
  return placeCode(record.status)
}

function placeCode(value: string | null | undefined) {
  return value && PLACE_STATUS.has(value) ? value : null
}

function validPoint(latitude: number | null | undefined, longitude: number | null | undefined) {
  if (latitude == null || longitude == null) {
    return { latitude: null, longitude: null }
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { latitude: null, longitude: null }
  }
  return { latitude, longitude }
}

function asNumber(value: unknown) {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(number) ? number : null
}
