// Client side of site search (ADR 0030): result labels and the event beacon.

export interface SearchHit {
  kind: 'place' | 'route' | 'collection' | 'quest' | 'venue' | 'hub' | 'city'
  path: string
  title: string
  label: string
  region: string
  snippet: string
}

export interface SearchResponse {
  query: string
  normalized: string
  results: SearchHit[]
}

export type SearchClientEvent
  = | { type: 'search', id: string, q: string, count: number, surface: string }
    | { type: 'click', id: string, position: number, path: string }

const SURFACES = new Set(['header', 'page', '404'])

export function searchSurface(value: unknown) {
  const text = Array.isArray(value) ? value[0] : value
  return typeof text === 'string' && SURFACES.has(text) ? text : 'page'
}

export function searchQueryParam(value: unknown) {
  const text = Array.isArray(value) ? value[0] : value
  return typeof text === 'string' ? text.trim().slice(0, 100) : ''
}

/** Russian plural for «результат». */
export function resultsLabel(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) {
    return `${count} результат`
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} результата`
  }
  return `${count} результатов`
}

export function newSearchId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function sendSearchEvents(events: SearchClientEvent[]) {
  if (!events.length || typeof window === 'undefined') {
    return
  }
  const body = JSON.stringify({ events })
  if (navigator.sendBeacon?.('/api/search/events', new Blob([body], { type: 'application/json' }))) {
    return
  }
  fetch('/api/search/events', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {})
}
