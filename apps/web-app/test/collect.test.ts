import type { H3Event } from 'h3'
import { beforeEach, describe, expect, it } from 'vitest'
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
import { COLLECT_LIMIT, COLLECT_WINDOW_MS, collectRateKey, resetCollectSlots, takeCollectSlot } from '../server/utils/analytics/rate'

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

  it('keys the bucket with the daily visitor hash and leaves the ip out', () => {
    const event = {
      context: {},
      node: {
        req: {
          headers: {
            'user-agent': 'Mozilla/5.0',
            'x-forwarded-for': '203.0.113.9',
          },
          socket: { remoteAddress: '203.0.113.9' },
        },
      },
    } as H3Event
    const key = collectRateKey(event, Date.parse('2026-10-21T00:00:00Z'))
    expect(key).toHaveLength(32)
    expect(key).not.toContain('203.0.113.9')
    expect(collectRateKey(event, Date.parse('2026-10-22T00:00:00Z'))).not.toBe(key)
  })
})
