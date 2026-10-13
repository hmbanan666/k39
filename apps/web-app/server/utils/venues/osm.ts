import type { OverpassElement } from '../../../shared/venues'

export async function fetchOverpass(query: string) {
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'user-agent': 'K39 venues (https://k39.online)',
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    throw createError({ statusCode: 502, statusMessage: 'Overpass не ответил' })
  }
  const payload = await response.json() as { elements?: OverpassElement[] }
  return payload.elements ?? []
}
