import type { H3Event } from 'h3'
import { Buffer } from 'node:buffer'
import { createServer, request } from 'node:http'
import { Readable } from 'node:stream'
import { createEvent } from 'h3'
import { beforeEach, describe, expect, it } from 'vitest'
import collectHandler from '../server/api/collect.post'
import {
  COLLECT_BODY_MAX,
  COLLECT_ENTITY_MAX,
  COLLECT_EVENT_CAP,
  COLLECT_REF_MAX,
  collectBodyDeclaredTooLarge,
  collectBodyTooLarge,
  collectLookupPaths,
  normalizeCollectEvents,
  resolveCollectSubjects,
} from '../server/utils/analytics/collect'
import { COLLECT_LIMIT, COLLECT_MAX_KEYS, COLLECT_WINDOW_MS, collectRateKey, resetCollectSlots, takeCollectSlot } from '../server/utils/analytics/rate'

describe('collect input', () => {
  it('truncates long strings and drops non-strings', () => {
    const events = normalizeCollectEvents({
      events: [
        {
          type: 'pageview',
          path: 'p'.repeat(COLLECT_REF_MAX + 80),
          ref: 12,
          entity: { nope: true },
          target: ['no'],
          lang: 'ru-RU-extra-extra',
          w: 'lg',
          ms: '15',
          scroll: 40,
        },
        { type: 5, path: '/ignored' },
        'bad',
        {
          type: 'engage',
          ref: 'r'.repeat(900),
          entity: `/${'e'.repeat(COLLECT_ENTITY_MAX + 40)}`,
          w: { bad: true },
        },
      ],
    })
    expect(events).toHaveLength(2)
    expect(events[0]?.path).toHaveLength(500)
    expect(events[0]?.ref).toBeUndefined()
    expect(events[0]?.entity).toBeUndefined()
    expect(events[0]?.target).toBeUndefined()
    expect(events[0]?.lang).toHaveLength(12)
    expect(events[0]).toMatchObject({ w: 'lg', ms: '15', scroll: 40 })
    expect(events[1]?.ref).toHaveLength(COLLECT_REF_MAX)
    expect(events[1]?.entity).toHaveLength(COLLECT_ENTITY_MAX)
    expect(events[1]?.w).toBeUndefined()
  })

  it('keeps at most the beacon cap', () => {
    const events = normalizeCollectEvents({
      events: Array.from({ length: 30 }, (_, index) => ({ type: 'pageview', path: `/${index}` })),
    })
    expect(events).toHaveLength(COLLECT_EVENT_CAP)
    expect(COLLECT_EVENT_CAP).toBeLessThan(20)
  })

  it('refuses a body past the cap and accepts one at the cap', () => {
    expect(collectBodyTooLarge(COLLECT_BODY_MAX)).toBe(false)
    expect(collectBodyTooLarge(COLLECT_BODY_MAX + 1)).toBe(true)
    expect(collectBodyDeclaredTooLarge(undefined)).toBe(false)
    expect(collectBodyDeclaredTooLarge(String(COLLECT_BODY_MAX))).toBe(false)
    expect(collectBodyDeclaredTooLarge(String(COLLECT_BODY_MAX + 1))).toBe(true)
    expect(collectBodyDeclaredTooLarge('nope')).toBe(false)
  })

  it('asks the resolver once for the distinct paths in the batch', async () => {
    const events = normalizeCollectEvents({
      events: [
        { type: 'pageview', path: '/fort' },
        { type: 'impression', path: '/fort', target: '/zavedeniya/cafe', entity: '/fort?x=1' },
        { type: 'impression', path: '/fort', target: '/zavedeniya/cafe', entity: '/marshruty/walk' },
        { type: 'engage', path: '/fort', entity: 'not-a-path' },
        { type: 'directions', path: '/marshruty/walk', entity: '/zavedeniya/cafe' },
        ...Array.from({ length: 8 }, () => ({ type: 'pageview', path: '/fort' })),
      ],
    })
    const calls: string[][] = []
    const subjects = await resolveCollectSubjects(events, '/fallback', async (paths) => {
      calls.push([...paths])
      return new Map(paths.map((path) => [path, { placeId: path, routeId: null, venueId: null }]))
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual(['/fort', '/zavedeniya/cafe', '/marshruty/walk'])
    expect(subjects.get('/fort')?.placeId).toBe('/fort')
    expect(collectLookupPaths([], '/fallback')).toEqual([])

    const quiet: string[][] = []
    await resolveCollectSubjects(
      normalizeCollectEvents([{ type: 'engage', path: '/fort' }]),
      '/fallback',
      async (paths) => {
        quiet.push(paths)
        return new Map()
      },
    )
    expect(quiet).toEqual([])
  })
})

describe('collect rate limit', () => {
  beforeEach(() => {
    resetCollectSlots()
  })

  it('allows a minute of beacons and then refuses until the window moves', () => {
    for (let index = 0; index < COLLECT_LIMIT; index++) {
      expect(takeCollectSlot('visitor-a', 1_000 + index)).toBe(true)
    }
    expect(takeCollectSlot('visitor-a', 1_000 + COLLECT_LIMIT)).toBe(false)
    expect(takeCollectSlot('visitor-b', 1_000)).toBe(true)
    const lastStamp = 1_000 + COLLECT_LIMIT - 1
    expect(takeCollectSlot('visitor-a', lastStamp + COLLECT_WINDOW_MS)).toBe(true)
  })

  it('hashes the ip only, so a new user agent stays in the same bucket', () => {
    const key = collectRateKey(rateEvent('203.0.113.9', 'Mozilla/5.0'))
    expect(key).toHaveLength(32)
    expect(key).not.toContain('203.0.113.9')
    expect(collectRateKey(rateEvent('203.0.113.9', 'OtherAgent/1'))).toBe(key)
    expect(collectRateKey(rateEvent('203.0.113.10', 'Mozilla/5.0'))).not.toBe(key)
  })

  it('refuses a new address when the map is full and sweeps expired keys once the window ends', () => {
    const now = 5_000
    for (let index = 0; index < COLLECT_MAX_KEYS; index++) {
      expect(takeCollectSlot(`ip-${index}`, now)).toBe(true)
    }
    expect(takeCollectSlot('ip-new', now)).toBe(false)
    expect(takeCollectSlot('ip-0', now)).toBe(true)
    expect(takeCollectSlot('ip-new', now + 1_000)).toBe(false)
    expect(takeCollectSlot('ip-new', now + COLLECT_WINDOW_MS)).toBe(true)
  })
})

function rateEvent(ip: string, ua: string) {
  return {
    context: {},
    node: {
      req: {
        headers: {
          'user-agent': ua,
          'x-forwarded-for': ip,
        },
        socket: { remoteAddress: ip },
      },
    },
  } as H3Event
}

describe('collect http limits', () => {
  beforeEach(() => {
    resetCollectSlots()
  })

  it('answers 204 when the address is over its budget, including after a user-agent change', async () => {
    const key = collectRateKey(rateEvent('203.0.113.50', 'Mozilla/5.0'))
    for (let index = 0; index < COLLECT_LIMIT; index++) {
      expect(takeCollectSlot(key)).toBe(true)
    }
    const first = await postCollect('203.0.113.50', 'RotatedAgent/9', Buffer.from('{"events":[{"type":"pageview","path":"/fort"}]}'))
    const second = await postCollect('203.0.113.50', 'AnotherAgent/2', Buffer.from('{"events":[]}'))
    expect(first.status).toBe(204)
    expect(second.status).toBe(204)
  })

  it('answers 413 when a chunked body grows past the cap', async () => {
    const body = Readable.from((async function* () {
      yield Buffer.alloc(COLLECT_BODY_MAX, 0x61)
      yield Buffer.alloc(64, 0x62)
    })())
    const response = await postCollect('203.0.113.51', 'Mozilla/5.0', body)
    expect(response.status).toBe(413)
  })
})

function postCollect(ip: string, ua: string, body: Buffer | Readable) {
  const server = createServer((req, res) => {
    const event = createEvent(req, res)
    Promise.resolve(collectHandler(event)).catch((error: { statusCode?: number }) => {
      if (!res.writableEnded) {
        res.statusCode = error.statusCode || 500
        res.end()
      }
    })
  })
  return new Promise<{ status: number }>((resolve, reject) => {
    let settled = false
    const finish = (error?: unknown, status?: number) => {
      if (settled) {
        return
      }
      settled = true
      server.close()
      if (error) {
        reject(error)
        return
      }
      resolve({ status: status ?? 0 })
    }
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      const headers: Record<string, string | number> = {
        'content-type': 'application/json',
        'x-forwarded-for': ip,
        'user-agent': ua,
      }
      if (Buffer.isBuffer(body)) {
        headers['content-length'] = body.length
      }
      const req = request({
        hostname: '127.0.0.1',
        port,
        path: '/api/collect',
        method: 'POST',
        headers,
      }, (res) => {
        res.resume()
        res.on('end', () => finish(undefined, res.statusCode ?? 0))
      })
      req.on('error', (error) => finish(error))
      if (Buffer.isBuffer(body)) {
        req.end(body)
      } else {
        body.pipe(req)
      }
    })
  })
}
