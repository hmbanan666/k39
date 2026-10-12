import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { contentAuthFailure } from '../server/utils/access'
import { normalizePublication } from '../server/utils/mcp/draft'
import { parseFactsCheckedAt } from '../server/utils/mcp/facts'
import { routeIdForSlug, routeSlugOf } from '../server/utils/mcp/quests'
import { resetContentSlots, takeContentSlot } from '../server/utils/mcp/rate-limit'
import { regionView, resolveCenter } from '../server/utils/mcp/regions'
import { placeFields } from '../server/utils/mcp/schemas'

describe('content MCP auth', () => {
  const previous = process.env.CONTENT_API_TOKEN

  afterEach(() => {
    process.env.CONTENT_API_TOKEN = previous
  })

  it('returns 401 without the bearer token and 503 when the token is unset', () => {
    process.env.CONTENT_API_TOKEN = 'secret-token'
    expect(contentAuthFailure(undefined)).toEqual({ statusCode: 401, statusMessage: 'Unauthorized' })
    expect(contentAuthFailure('Bearer other')).toEqual({ statusCode: 401, statusMessage: 'Unauthorized' })
    expect(contentAuthFailure('Bearer secret-token')).toBeNull()
    delete process.env.CONTENT_API_TOKEN
    expect(contentAuthFailure('Bearer secret-token')?.statusCode).toBe(503)
  })

  it('limits repeated calls for one token', () => {
    resetContentSlots()
    expect(takeContentSlot('secret-token', 2, 1_000)).toBe(1)
    expect(takeContentSlot('secret-token', 2, 1_000)).toBe(2)
    expect(() => takeContentSlot('secret-token', 2, 1_000)).toThrowError()
    try {
      takeContentSlot('secret-token', 2, 1_000)
    } catch (error) {
      expect((error as { statusCode: number }).statusCode).toBe(429)
    }
  })
})

describe('publication status', () => {
  it('allows publish and unpublish with the same statuses as the admin form', () => {
    expect(normalizePublication(undefined)).toBe('draft')
    expect(normalizePublication('published')).toBe('published')
    expect(normalizePublication('draft', 'published')).toBe('draft')
    expect(normalizePublication('review', 'published')).toBe('review')
    expect(normalizePublication(undefined, 'published')).toBe('published')
    expect(normalizePublication(undefined, 'archived')).toBe('archived')
    expect(() => normalizePublication('archived')).toThrowError()
  })
})

describe('region center', () => {
  it('treats coordinates and center as one optional point', () => {
    expect(resolveCenter({})).toBeUndefined()
    expect(resolveCenter({ center: { latitude: 54.96, longitude: 20.48 } })).toEqual({
      latitude: 54.96,
      longitude: 20.48,
    })
    expect(resolveCenter({ coordinates: null })).toEqual({ latitude: null, longitude: null })
    expect(resolveCenter({
      coordinates: { latitude: 54.96, longitude: 20.48 },
      center: { latitude: 54.96, longitude: 20.48 },
    })).toEqual({ latitude: 54.96, longitude: 20.48 })
    expect(() => resolveCenter({
      coordinates: { latitude: 1, longitude: 2 },
      center: { latitude: 3, longitude: 4 },
    })).toThrowError()
    expect(() => resolveCenter({ center: { latitude: 91, longitude: 0 } })).toThrowError()
  })

  it('hides a half-filled center', () => {
    expect(regionView({
      id: 'region-1',
      slug: 'zelenogradsk',
      title: 'Зеленоградский муниципальный округ',
      description: null,
      latitude: 54.96,
      longitude: null,
    }).center).toBeNull()
  })
})

describe('factsCheckedAt', () => {
  it('accepts an ISO date by itself and stores date-only values at UTC midnight', () => {
    const schema = z.object({ id: z.string().optional(), ...placeFields })
    expect(schema.parse({ id: 'place-1', factsCheckedAt: '2026-10-12' })).toMatchObject({
      id: 'place-1',
      factsCheckedAt: '2026-10-12',
    })
    expect(schema.parse({ slug: 'fort-11-denhoff', factsCheckedAt: null }).factsCheckedAt).toBeNull()
    expect(parseFactsCheckedAt(undefined)).toBeUndefined()
    expect(parseFactsCheckedAt(null)).toBeNull()
    expect(parseFactsCheckedAt('2026-10-12')).toBe('2026-10-12T00:00:00.000Z')
    expect(parseFactsCheckedAt('2026-10-12T15:04:05.000Z')).toBe('2026-10-12T15:04:05.000Z')
    expect(() => parseFactsCheckedAt('12.10.2026')).toThrowError()
    expect(() => parseFactsCheckedAt('2026-02-31')).toThrowError()
    try {
      parseFactsCheckedAt('вчера')
    } catch (error) {
      expect((error as { statusCode: number }).statusCode).toBe(400)
    }
  })
})

describe('quest route link', () => {
  const routes = [
    { id: 'route-draft', slug: 'draft-route' },
    { id: 'route-live', slug: 'live-route' },
  ]

  it('retargets a quest onto a draft route or clears the link', () => {
    expect(routeIdForSlug(undefined, routes)).toBeUndefined()
    expect(routeIdForSlug(null, routes)).toBeNull()
    expect(routeIdForSlug('draft-route', routes)).toBe('route-draft')
    expect(routeSlugOf('route-live', routes)).toBe('live-route')
    expect(routeSlugOf(null, routes)).toBeNull()
    expect(() => routeIdForSlug('missing', routes)).toThrowError()
    try {
      routeIdForSlug('missing', routes)
    } catch (error) {
      expect((error as { statusCode: number }).statusCode).toBe(400)
    }
  })
})
