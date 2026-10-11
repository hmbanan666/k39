import { afterEach, describe, expect, it } from 'vitest'
import { contentAuthFailure } from '../server/utils/access'
import { normalizePublication } from '../server/utils/mcp/draft'
import { resetContentSlots, takeContentSlot } from '../server/utils/mcp/rate-limit'

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
    expect(() => normalizePublication('archived')).toThrowError()
  })
})
