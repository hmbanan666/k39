import type { OsmElement } from '@k39/database'
import process from 'node:process'
import { assertOverpassArea, osmElementToDraft, OVERPASS_QUERY_TIMEOUT_SECONDS, overpassQuery, VenueInputError } from '@k39/database'

export const OVERPASS_USER_AGENT = 'K39/1.0 (+https://k39.online)'
export const OVERPASS_FETCH_TIMEOUT_MS = 120_000
export const OVERPASS_DEFAULT_URL = 'https://overpass-api.de/api/interpreter'
export const OVERPASS_MIRROR_URL = 'https://overpass.kumi.systems/api/interpreter'

const ATTEMPTS = 3
const RETRY_STATUSES = new Set([406, 408, 429, 500, 502, 503, 504])

export interface OverpassArea {
  latitude: number
  longitude: number
  radiusMeters: number
}

export interface OverpassBox {
  south: number
  west: number
  north: number
  east: number
}

export interface OverpassFetchOptions {
  fetch?: (url: string, init?: RequestInit) => Promise<Response>
  sleep?: (ms: number) => Promise<void>
  endpoints?: string[]
}

export function overpassBackoffMs(attempt: number) {
  return 500 * 2 ** attempt
}

export function overpassEndpoints(configured?: string | null) {
  const primary = configured?.trim() || OVERPASS_DEFAULT_URL
  if (primary === OVERPASS_MIRROR_URL) {
    return [OVERPASS_MIRROR_URL, OVERPASS_DEFAULT_URL]
  }
  return [primary, OVERPASS_MIRROR_URL]
}

class OverpassRequestError extends VenueInputError {
  constructor(message: string, readonly retryable: boolean) {
    super(message)
    this.name = 'OverpassRequestError'
  }
}

function sleepMs(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function postQuery(endpoint: string, body: URLSearchParams, fetchImpl: OverpassFetchOptions['fetch'], sleep: (ms: number) => Promise<void>) {
  const request = fetchImpl ?? fetch
  let last: OverpassRequestError | null = null
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(overpassBackoffMs(attempt - 1))
    }
    try {
      const response = await request(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'accept': 'application/json',
          'user-agent': OVERPASS_USER_AGENT,
        },
        body,
        signal: AbortSignal.timeout(OVERPASS_FETCH_TIMEOUT_MS),
      })
      if (response.ok) {
        return response
      }
      const error = new OverpassRequestError(`Overpass ответил ${response.status}`, RETRY_STATUSES.has(response.status))
      if (!error.retryable || attempt === ATTEMPTS - 1) {
        throw error
      }
      last = error
    } catch (error) {
      if (error instanceof OverpassRequestError) {
        throw error
      }
      last = new OverpassRequestError('Overpass недоступен', true)
      if (attempt === ATTEMPTS - 1) {
        throw last
      }
    }
  }
  throw last ?? new OverpassRequestError('Overpass недоступен', true)
}

export async function fetchOverpass(input: OverpassArea | OverpassBox, options: OverpassFetchOptions = {}) {
  assertOverpassArea(input)
  const body = new URLSearchParams({ data: overpassQuery(input, OVERPASS_QUERY_TIMEOUT_SECONDS) })
  const endpoints = options.endpoints ?? overpassEndpoints(process.env.OVERPASS_URL)
  const sleep = options.sleep ?? sleepMs
  let last: unknown
  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index]
    if (!endpoint) {
      continue
    }
    try {
      const response = await postQuery(endpoint, body, options.fetch, sleep)
      let payload: { elements?: OsmElement[] }
      try {
        payload = await response.json() as { elements?: OsmElement[] }
      } catch {
        throw new OverpassRequestError('Overpass ответил не JSON', true)
      }
      return (payload.elements ?? []).flatMap((element) => {
        const draft = osmElementToDraft(element)
        return draft ? [draft] : []
      }).slice(0, 100)
    } catch (error) {
      last = error
      const retryable = error instanceof OverpassRequestError && error.retryable
      if (!retryable || index === endpoints.length - 1) {
        if (error instanceof VenueInputError) {
          throw error
        }
        throw new VenueInputError('Overpass недоступен')
      }
    }
  }
  if (last instanceof VenueInputError) {
    throw last
  }
  throw new VenueInputError('Overpass недоступен')
}
