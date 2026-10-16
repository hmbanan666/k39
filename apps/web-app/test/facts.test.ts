import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { extractPdfText } from '../server/utils/facts/fetch'
import { FACT_UNKNOWN, omitFactGap, projectShownFacts } from '../server/utils/facts/read'
import { phoneNumbers, publicProse, publicVenueModules, repeatedKinds } from '../shared/fact-prose'
import { classifySourceUrl, decideWatch, defaultTtl, isBlockedAddress, isBlockedHostname, isUnwatchedUrl, mapSourceAllowed, normalizeSourceText, ownerBlocksToken, pageTraffic, pastTtl, priorityFor, proseHash, reviewUpdate, seasonBoundaryWithin, shouldWriteContact, trustOf, trustText, valueHash, watchableSource } from '../shared/facts'

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
    expect(classifySourceUrl('https://www.google.com/maps/place/Brikas')).toBe('map_google')
    expect(classifySourceUrl('https://maps.google.com/?q=cafe')).toBe('map_google')
    expect(classifySourceUrl('https://maps.app.goo.gl/abc')).toBe('map_google')
    expect(classifySourceUrl('https://www.google.com/search?q=cafe')).toBe('official')
    expect(classifySourceUrl('https://www.openstreetmap.org/node/1')).toBe('osm')
    expect(watchableSource('map_yandex', 'https://yandex.ru/maps/org/cafe/1')).toBe(false)
    expect(watchableSource('map_google', 'https://maps.google.com/?q=cafe')).toBe(false)
    expect(isUnwatchedUrl('https://www.google.com/maps/place/Brikas')).toBe(true)
    expect(mapSourceAllowed('venue', 'phone', 'map_google')).toBe(true)
    expect(mapSourceAllowed('venue', 'price', 'map_google')).toBe(false)
    expect(mapSourceAllowed('place', 'coordinates', 'map_yandex')).toBe(false)
    expect(mapSourceAllowed('place', 'coordinates', 'official')).toBe(true)
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

const BRIKAS = 'Ресторан литовской кухни «Брикас» на Театральной улице, 30, в центре Калининграда. Зал оформлен как старая таверна. В меню цеппелины. Открыт ежедневно с 10:00 до 22:00. Телефоны для брони +7 (4012) 61-64-12 и +7 (4012) 53-16-28.'

describe('public fact reader', () => {
  const columns = {
    phone: '+7 4012 00-00-00',
    address: 'ул. Старая, 1',
    latitude: 54.7,
    longitude: 20.5,
    status: 'published',
  }

  it('reads a stated fact and ignores the column', () => {
    const shown = projectShownFacts('venue', 'v1', columns, [{
      path: 'short.phone',
      kind: 'phone',
      slot: 'phone',
      value: { text: '+7 4012 61-64-12' },
      confidence: 'stated',
      subjectType: 'venue',
      subjectId: 'v1',
    }])
    expect(shown.phone).toBe('+7 4012 61-64-12')
    expect(shown.address).toBe(columns.address)
    expect(omitFactGap(shown.phone)).toBe('+7 4012 61-64-12')
  })

  it('renders a gap as уточняйте and does not fall back to the column', () => {
    const shown = projectShownFacts('venue', 'v1', columns, [
      { path: 'short.phone', kind: 'phone', slot: 'phone', value: { text: columns.phone }, confidence: 'gap', subjectType: 'venue', subjectId: 'v1' },
      { path: 'short.address', kind: 'address', slot: 'address', value: { text: columns.address }, confidence: 'gap', subjectType: 'venue', subjectId: 'v1' },
      { path: 'short.coordinates', kind: 'coordinates', slot: 'coordinates', value: { latitude: columns.latitude, longitude: columns.longitude }, confidence: 'gap', subjectType: 'venue', subjectId: 'v1' },
      { path: 'short.status', kind: 'status', slot: 'status', value: { scope: 'venue', status: 'closed' }, confidence: 'gap', subjectType: 'venue', subjectId: 'v1' },
    ])
    expect(shown.phone).toBe(FACT_UNKNOWN)
    expect(shown.address).toBe(FACT_UNKNOWN)
    expect(shown.latitude).toBeNull()
    expect(shown.longitude).toBeNull()
    expect(shown.status).toBeNull()
    expect(shown.statusGap).toBe(true)
    expect(omitFactGap(shown.phone)).toBeNull()
  })

  it('uses the column only when no fact is cited', () => {
    const shown = projectShownFacts('venue', 'v1', { ...columns, status: 'closed' }, [])
    expect(shown.phone).toBe(columns.phone)
    expect(shown.latitude).toBe(columns.latitude)
    expect(shown.status).toBe('closed')
    expect(shown.statusGap).toBe(false)
    const place = projectShownFacts('place', 'p1', { status: 'closed', latitude: 54.65, longitude: 20.5 }, [])
    expect(place.status).toBe('closed')
    const gap = projectShownFacts('place', 'p1', { status: 'closed', latitude: 54.65, longitude: 20.5 }, [
      { path: 'short.status', kind: 'status', slot: 'status', value: { scope: 'place', status: 'closed' }, confidence: 'gap', subjectType: 'place', subjectId: 'p1' },
    ])
    expect(gap.status).toBe('unknown')
  })

  it('writes a contact fact when the column was saved before the fact existed', () => {
    expect(shouldWriteContact(true, true, '+7 4012 61-64-12')).toBe(true)
    expect(shouldWriteContact(false, false, '+7 4012 61-64-12')).toBe(true)
    expect(shouldWriteContact(false, true, '+7 4012 61-64-12')).toBe(false)
    expect(shouldWriteContact(false, false, null)).toBe(false)
  })

  it('shows one phone for Брикас and treats the article copy as a warning', () => {
    const hours = ['Ежедневно 10:00–22:00']
    const page = publicProse(BRIKAS, hours)
    expect(phoneNumbers(page)).toEqual([])
    expect(page).not.toContain('10:00')
    expect(page).toContain('Брикас')
    expect(phoneNumbers(BRIKAS)).toEqual(['74012616412', '74012531628'])
    expect(repeatedKinds(BRIKAS, hours)).toEqual(['phone', 'hours'])
    const modules = publicVenueModules([
      { type: 'text', text: 'Телефон +7 (4012) 53-16-28.' },
      { type: 'practical', items: [{ key: 'other', label: 'Телефон', value: '+7 4012 61-64-12' }] },
    ], hours)
    expect(JSON.stringify(modules)).not.toContain('4012')
  })
})
