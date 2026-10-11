import { afterEach, describe, expect, it } from 'vitest'
import { contentAuthFailure } from '../server/utils/access'
import { draftStatus } from '../server/utils/mcp/draft'
import { createPlaceDraft } from '../server/utils/mcp/places'
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

describe('place draft writes', () => {
  it('refuses to publish and allows review', async () => {
    expect(draftStatus(undefined)).toBe('draft')
    expect(draftStatus('review')).toBe('review')
    expect(draftStatus('draft', 'review')).toBe('draft')
    expect(() => draftStatus('published')).toThrowError()
    expect(() => draftStatus('review', 'published')).toThrowError()
    await expect(createPlaceDraft({
      slug: 'mcp-test',
      title: 'Проверка',
      publicationStatus: 'published',
    })).rejects.toMatchObject({ statusCode: 400 })
  })
})
