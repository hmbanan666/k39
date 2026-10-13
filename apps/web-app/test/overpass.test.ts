import { describe, expect, it } from 'vitest'
import {
  fetchOverpass,
  OVERPASS_DEFAULT_URL,
  OVERPASS_FETCH_TIMEOUT_MS,
  OVERPASS_MIRROR_URL,
  OVERPASS_USER_AGENT,
  overpassBackoffMs,
  overpassEndpoints,
} from '../server/utils/venues/overpass'

const area = { latitude: 54.7, longitude: 20.5, radiusMeters: 800 }

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('overpass client', () => {
  it('sends a descriptive user agent, a query timeout, and retries before the mirror', async () => {
    expect(OVERPASS_FETCH_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000)
    expect(overpassBackoffMs(0)).toBe(500)
    expect(overpassBackoffMs(1)).toBe(1000)
    expect(overpassEndpoints()).toEqual([OVERPASS_DEFAULT_URL, OVERPASS_MIRROR_URL])
    expect(overpassEndpoints(OVERPASS_MIRROR_URL)).toEqual([OVERPASS_MIRROR_URL, OVERPASS_DEFAULT_URL])
    const calls: Array<{ url: string, userAgent: string | null, query: string, timeout: number }> = []
    const sleeps: number[] = []
    let attempt = 0
    const rows = await fetchOverpass(area, {
      endpoints: [OVERPASS_DEFAULT_URL, OVERPASS_MIRROR_URL],
      sleep: async (ms) => {
        sleeps.push(ms)
      },
      fetch: async (url, init) => {
        const headers = new Headers(init?.headers)
        const params = new URLSearchParams(String(init?.body))
        calls.push({
          url,
          userAgent: headers.get('user-agent'),
          query: params.get('data') || '',
          timeout: init?.signal ? 1 : 0,
        })
        attempt += 1
        if (attempt === 1) {
          return jsonResponse(406, { remark: 'no user agent' })
        }
        return jsonResponse(200, {
          elements: [{
            type: 'node',
            id: 9,
            lat: 54.7,
            lon: 20.5,
            tags: { amenity: 'cafe', name: 'Уют' },
          }],
        })
      },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.slug).toBe('uyut')
    expect(sleeps).toEqual([500])
    expect(calls).toHaveLength(2)
    expect(calls.every((call) => call.userAgent === OVERPASS_USER_AGENT)).toBe(true)
    expect(calls[0]?.userAgent).toBe('K39/1.0 (+https://k39.online)')
    expect(calls[0]?.query).toContain('[timeout:90]')
    expect(calls.every((call) => call.timeout === 1)).toBe(true)
    expect(calls.every((call) => call.url === OVERPASS_DEFAULT_URL)).toBe(true)
  })

  it('falls back to the mirror after retryable failures and does not retry a bad query', async () => {
    const urls: string[] = []
    const sleeps: number[] = []
    const rows = await fetchOverpass(area, {
      endpoints: [OVERPASS_DEFAULT_URL, OVERPASS_MIRROR_URL],
      sleep: async (ms) => {
        sleeps.push(ms)
      },
      fetch: async (url) => {
        urls.push(url)
        if (url === OVERPASS_DEFAULT_URL) {
          return jsonResponse(503, {})
        }
        return jsonResponse(200, { elements: [] })
      },
    })
    expect(rows).toEqual([])
    expect(urls.filter((url) => url === OVERPASS_DEFAULT_URL)).toHaveLength(3)
    expect(urls.at(-1)).toBe(OVERPASS_MIRROR_URL)
    expect(sleeps).toEqual([500, 1000])

    const bad: string[] = []
    await expect(fetchOverpass(area, {
      endpoints: [OVERPASS_DEFAULT_URL, OVERPASS_MIRROR_URL],
      sleep: async () => {},
      fetch: async (url) => {
        bad.push(url)
        return jsonResponse(400, { remark: 'bad query' })
      },
    })).rejects.toThrow('Overpass ответил 400')
    expect(bad).toEqual([OVERPASS_DEFAULT_URL])
  })
})
