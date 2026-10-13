import type { OsmElement } from '@k39/database'
import process from 'node:process'
import { assertOverpassArea, osmElementToDraft, overpassQuery, VenueInputError } from '@k39/database'

const DEFAULT_URL = 'https://overpass-api.de/api/interpreter'

export async function fetchOverpass(input: { latitude: number, longitude: number, radiusMeters: number } | { south: number, west: number, north: number, east: number }) {
  assertOverpassArea(input)
  const endpoint = process.env.OVERPASS_URL?.trim() || DEFAULT_URL
  const body = new URLSearchParams({ data: overpassQuery(input) })
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    throw new VenueInputError(`Overpass ответил ${response.status}`)
  }
  const payload = await response.json() as { elements?: OsmElement[] }
  return (payload.elements ?? []).flatMap((element) => {
    const draft = osmElementToDraft(element)
    return draft ? [draft] : []
  }).slice(0, 100)
}
