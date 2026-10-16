import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { extractPdfText } from '../server/utils/facts/fetch'
import { classifySourceUrl, decideWatch, defaultTtl, isBlockedAddress, isBlockedHostname, isUnwatchedUrl, normalizeSourceText, ownerBlocksToken, pageTraffic, pastTtl, priorityFor, proseHash, reviewUpdate, seasonBoundaryWithin, trustOf, trustText, valueHash, watchableSource } from '../shared/facts'

describe('fact values', () => {
  it('keeps a map phone on the 180-day kind TTL', () => {
    expect(defaultTtl('phone')).toBe(180)
    expect(defaultTtl('hours')).toBe(30)
    expect(defaultTtl('price')).toBe(90)
    expect(defaultTtl('address')).toBe(365)
  })

  it('hashes canonical JSON independent of key order', () => {
    expect(valueHash({ b: 1, a: { d: 2, c: 3 } })).toBe(valueHash({ a: { c: 3, d: 2 }, b: 1 }))
    expect(valueHash({ a: 1 })).not.toBe(valueHash({ a: 2 }))
  })

  it('classifies official, social, and map hosts', () => {
    expect(classifySourceUrl('https://museum.example/hours')).toBe('official')
    expect(classifySourceUrl('https://vk.com/cafe')).toBe('official_social')
    expect(classifySourceUrl('https://yandex.ru/maps/org/cafe/1')).toBe('map_yandex')
    expect(classifySourceUrl('https://2gis.ru/kaliningrad/firm/1')).toBe('map_2gis')
    expect(classifySourceUrl('https://www.openstreetmap.org/node/1')).toBe('osm')
    expect(watchableSource('map_yandex', 'https://yandex.ru/maps/org/cafe/1')).toBe(false)
    expect(watchableSource('official', 'https://museum.example/hours')).toBe(true)
    expect(isUnwatchedUrl('https://yandex.ru/maps/org/1')).toBe(true)
    expect(isUnwatchedUrl('https://museum.example/hours')).toBe(false)
  })

  it('blocks private and local addresses', () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true)
    expect(isBlockedAddress('10.1.2.3')).toBe(true)
    expect(isBlockedAddress('169.254.169.254')).toBe(true)
    expect(isBlockedAddress('8.8.8.8')).toBe(false)
    expect(isBlockedAddress('::1')).toBe(true)
    expect(isBlockedHostname('localhost')).toBe(true)
    expect(isBlockedHostname('db.internal')).toBe(true)
    expect(isBlockedHostname('museum.example')).toBe(false)
  })

  it('renews an unchanged hash and backs off a failure', () => {
    expect(decideWatch({ status: 200, error: false, previousHash: 'abc', nextHash: 'abc', failCount: 0 }).type).toBe('renew')
    expect(decideWatch({ status: 304, error: false, previousHash: 'abc', nextHash: null, failCount: 0 }).type).toBe('renew')
    expect(decideWatch({ status: 200, error: false, previousHash: 'abc', nextHash: 'def', failCount: 0 }).type).toBe('changed')
    expect(decideWatch({ status: 200, error: false, previousHash: null, nextHash: 'def', failCount: 0 }).type).toBe('record')
    expect(decideWatch({ status: 404, error: false, previousHash: 'abc', nextHash: null, failCount: 0 }).type).toBe('gone')
    const third = decideWatch({ status: 500, error: false, previousHash: 'abc', nextHash: null, failCount: 2 })
    expect(third.type).toBe('backoff')
    if (third.type === 'backoff') {
      expect(third.queue).toBe(true)
      expect(third.delayDays).toBe(4)
      expect(third.failCount).toBe(3)
    }
  })

  it('treats a past-TTL official match as a renew, not a new read', () => {
    const checked = new Date(Date.now() - 40 * 86_400_000).toISOString()
    expect(pastTtl(checked, 30)).toBe(true)
    expect(decideWatch({ status: 200, error: false, previousHash: 'same', nextHash: 'same', failCount: 0 }).type).toBe('renew')
  })

  it('does not let the content token overwrite an owner fact', () => {
    expect(ownerBlocksToken('owner', false)).toBe(true)
    expect(ownerBlocksToken('owner', true)).toBe(false)
    expect(ownerBlocksToken('mcp', false)).toBe(false)
  })

  it('drops script and style before the source hash', () => {
    const left = normalizeSourceText('<style>.x{}</style><p>Часы 10:00</p><script>alert(1)</script>')
    const right = normalizeSourceText('<p>Часы   10:00</p>')
    expect(left).toBe(right)
  })

  it('hashes extracted PDF text and fails closed when there is none', () => {
    const pdf = Buffer.from(`%PDF-1.1
1 0 obj << /Length 44 >> stream
BT /F1 12 Tf (Menu 300) Tj ET
endstream
endobj
trailer <<>>
%%EOF`)
    expect(extractPdfText(pdf)).toContain('Menu 300')
    expect(extractPdfText(Buffer.from('%PDF-1.1\ntrailer'))).toBeNull()
  })

  it('matches a reorder by hash and rejects a changed section', () => {
    const first = proseHash('Первый абзац')
    const second = proseHash('Второй абзац')
    const current = [
      { path: 'sections[0]', text: 'Второй абзац', hash: second },
      { path: 'sections[1]', text: 'Первый абзац', hash: first },
    ]
    expect(reviewUpdate(current, [{ path: 'sections[0]', hash: first }, { path: 'sections[1]', hash: second }], current.map((item) => ({ path: item.path, hash: item.hash })), true).ok).toBe(true)
    const changed = reviewUpdate(current, [{ path: 'sections[0]', hash: first }], [{ path: 'sections[0]', hash: 'nope' }], false)
    expect(changed.ok).toBe(false)
    expect(changed.rejected).toContain('sections[0]')
  })

  it('lets verified stand alone and shows stale with unreviewed', () => {
    expect(trustOf({ staleFacts: 0, unreviewed: 0 }).labels).toEqual(['verified'])
    expect(trustOf({ staleFacts: 2, unreviewed: 1 }).labels).toEqual(['stale', 'unreviewed'])
    expect(trustText(trustOf({ staleFacts: 2, unreviewed: 1 }))).toBe('2 устарели, 1 раздел')
  })

  it('weights hours above prose and counts a quiet page as 1', () => {
    expect(pageTraffic(0, 0)).toBe(1)
    expect(priorityFor('hours', 'ttl_expired', 1)).toBeGreaterThan(priorityFor('prose', 'section_changed', 1))
    expect(priorityFor('hours', 'season_boundary', 1)).toBe(priorityFor('hours', 'ttl_expired', 1) + 2)
  })

  it('queues a season boundary inside 30 days', () => {
    const now = new Date('2026-05-20T12:00:00.000Z')
    expect(seasonBoundaryWithin({ seasons: [{ from: '06-01', to: '08-31' }] }, now)).toBe(true)
    expect(seasonBoundaryWithin({ seasons: [{ from: '01-01', to: '01-10' }] }, now)).toBe(false)
  })
})
