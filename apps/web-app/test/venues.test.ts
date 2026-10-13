import { describe, expect, it } from 'vitest'
import { scorePage } from '../shared/scoring'
import { venueDocument } from '../shared/seo'
import { formatWalkingDistance, kindFromOsm, parseOpeningHours, rankNearbyVenues, venueFromOsm, venueIsStale, venueNearbyEligible } from '../shared/venues'

const NOW = new Date('2026-10-13T00:00:00Z')

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString()
}

describe('venue distance and staleness', () => {
  it('formats a walk in meters and kilometers', () => {
    expect(formatWalkingDistance(0.4)).toBe('400 м')
    expect(formatWalkingDistance(1.24)).toBe('1,2 км')
    expect(formatWalkingDistance(1)).toBe('1 км')
  })

  it('marks a check older than 180 days as stale and drops it from nearby after a year', () => {
    expect(venueIsStale(daysAgo(10), NOW)).toBe(false)
    expect(venueIsStale(daysAgo(200), NOW)).toBe(true)
    expect(venueIsStale(null, NOW)).toBe(true)
    expect(venueNearbyEligible(daysAgo(200), NOW)).toBe(true)
    expect(venueNearbyEligible(daysAgo(400), NOW)).toBe(false)
    expect(venueNearbyEligible(null, NOW)).toBe(false)
  })

  it('keeps the partner slot dark until the flag is on', () => {
    const rows = [
      { slug: 'near', distanceKm: 0.2, sponsored: false },
      { slug: 'cafe', distanceKm: 0.4, sponsored: true },
      { slug: 'far', distanceKm: 1.2, sponsored: false },
    ]
    expect(rankNearbyVenues(rows, false).map((row) => [row.slug, row.partner])).toEqual([
      ['near', false],
      ['cafe', false],
      ['far', false],
    ])
    expect(rankNearbyVenues(rows, true).map((row) => [row.slug, row.partner])).toEqual([
      ['cafe', true],
      ['near', false],
      ['far', false],
    ])
  })
})

describe('osm drafts', () => {
  it('maps a cafe and keeps the raw hours when the timetable is simple', () => {
    const draft = venueFromOsm({
      type: 'node',
      id: 42,
      lat: 54.7,
      lon: 20.5,
      tags: {
        'name': 'Чайка',
        'amenity': 'cafe',
        'cuisine': 'coffee',
        'opening_hours': 'Mo-Fr 09:00-18:00; Su off',
        'phone': '+74012345678',
        'website': 'https://chaika.example',
        'addr:city': 'Светлогорск',
        'addr:street': 'Октябрьская',
        'addr:housenumber': '4',
      },
    })
    expect(draft).toMatchObject({
      osmId: 'node/42',
      name: 'Чайка',
      kind: 'coffee',
      phone: '+74012345678',
      website: 'https://chaika.example',
      address: 'Светлогорск, Октябрьская, 4',
    })
    expect(draft?.hours.mon).toEqual([{ open: '09:00', close: '18:00' }])
    expect(draft?.hours.sun).toEqual([])
    expect(kindFromOsm({ amenity: 'fast_food' })).toBe('fastfood')
    expect(kindFromOsm({ shop: 'bakery' })).toBe('bakery')
    expect(venueFromOsm({ type: 'node', id: 1, lat: 1, lon: 2, tags: { amenity: 'cafe' } })).toBeNull()
  })

  it('leaves an unparsed timetable in the note', () => {
    expect(parseOpeningHours('sunrise-sunset')).toEqual({ note: 'sunrise-sunset' })
  })
})

describe('venue page score and json-ld', () => {
  it('noindexes a venue without a description and types a cafe as Restaurant', () => {
    const missing = venueDocument({
      slug: 'chaika',
      name: 'Чайка',
      description: '',
      kind: 'coffee',
      regionTitle: 'Светлогорск',
      regionSlug: 'svetlogorsk',
      address: 'Октябрьская, 4',
      latitude: 54.7,
      longitude: 20.5,
    })
    expect(missing.robots).toContain('noindex')
    const ready = venueDocument({
      slug: 'chaika',
      name: 'Кофейня на берегу в Светлогорске',
      description: 'а'.repeat(400),
      kind: 'coffee',
      regionTitle: null,
      address: null,
      latitude: 54.7,
      longitude: 20.5,
    })
    expect(ready.robots).toBe('index, follow')
    expect(ready.jsonLd.map((node) => node['@type'])).toEqual(['BreadcrumbList', 'Restaurant'])
    expect(ready.description.length).toBeGreaterThanOrEqual(110)
    expect(ready.description.length).toBeLessThanOrEqual(160)
  })

  it('scores description, photo, hours, the last check, and coordinates', () => {
    const thin = scorePage({
      kind: 'venue',
      id: 'v1',
      path: '/zavedeniya/chaika',
      title: 'Чайка',
      summary: 'коротко',
      body: '',
      howToGet: null,
      hours: null,
      price: null,
      categorySlug: 'cafe',
      categoryTitle: null,
      regionTitle: null,
      latitude: null,
      longitude: null,
      sources: [],
      publicationStatus: 'published',
      noindex: false,
      seoTitle: 'Кофейня Чайка на набережной Светлогорска',
      seoDescription: 'б'.repeat(120),
      factsCheckedAt: null,
      photoCount: 0,
      inRoute: false,
      inCollection: false,
      memberCount: 0,
      inbound: 2,
      contentOutbound: 3,
      orphan: false,
      passport: null,
      results: {
        organic7d: 0,
        organic30d: 0,
        organic90d: 0,
        searchImported: false,
        queries: [],
        pageviews30d: 0,
        scrollMax: null,
        avgEngagedSec: null,
        engagedTracked: false,
        scrollTracked: false,
        nextClicks: 0,
      },
    }, NOW)
    expect(thin.checks.quality).toEqual([
      'description 7 chars, need 300-600',
      '0 photos',
      'no hours',
      'facts not checked',
      'no coordinates',
    ])
    expect(thin.pageType).toBe('venue')
  })
})
