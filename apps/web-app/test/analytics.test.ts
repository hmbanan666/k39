import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dailyVisitorKey } from '../server/utils/analytics/identity'
import {
  classifyChannel,
  COLLECT_TYPES,
  isBotUserAgent,
  mergeHitEntities,
  parseUserAgent,
  resolvePeriod,
  screenBucket,
  searchQueryFromReferrer,
  trendPercent,
} from '../shared/analytics'

describe('analytics classification', () => {
  it('reads channels and the rare search query', () => {
    expect(classifyChannel({ referrer: '' }).channel).toBe('direct')
    expect(classifyChannel({ referrer: 'https://k39.online/forty' }).channel).toBe('internal')
    expect(classifyChannel({ referrer: 'https://yandex.ru/search/?text=рагнит' })).toMatchObject({
      channel: 'organic:yandex',
      searchQuery: 'рагнит',
    })
    expect(classifyChannel({ referrer: 'https://www.google.com/search?q=fort' }).channel).toBe('organic:google')
    expect(classifyChannel({ referrer: 'https://vk.com/wall1' }).channel).toBe('social:vk')
    expect(classifyChannel({ referrer: 'https://t.me/k39' }).channel).toBe('social:tg')
    expect(classifyChannel({ referrer: 'https://example.com/a' }).channel).toBe('referral')
    expect(classifyChannel({ referrer: '', utmMedium: 'cpc', utmSource: 'yandex' }).channel).toBe('paid')
    expect(searchQueryFromReferrer('https://yandex.ru/search/?text=замок')).toBe('замок')
  })

  it('parses a small user agent and buckets the screen', () => {
    const parsed = parseUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile')
    expect(parsed).toMatchObject({ device: 'mobile', browser: 'chrome', os: 'android', bot: false })
    expect(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true)
    expect(isBotUserAgent('')).toBe(true)
    expect(screenBucket(390)).toBe('xs')
    expect(screenBucket('lg')).toBe('lg')
  })

  it('hashes a daily visitor key without keeping the ip', () => {
    const key = dailyVisitorKey('salt', '2026-10-12', '203.0.113.8', 'Mozilla/5.0')
    expect(key).toHaveLength(32)
    expect(key).not.toContain('203.0.113.8')
    expect(dailyVisitorKey('salt', '2026-10-13', '203.0.113.8', 'Mozilla/5.0')).not.toBe(key)
  })

  it('compares a period with the one before it', () => {
    const range = resolvePeriod('7d', Date.parse('2026-10-12T00:00:00Z'))
    expect(range.to.getTime() - range.from.getTime()).toBe(7 * 86_400_000)
    expect(range.previousTo.getTime()).toBe(range.from.getTime())
    expect(trendPercent(110, 100)).toBe(10)
    expect(trendPercent(5, 0)).toBeNull()
  })

  it('keeps the beacon under 2 KB and sends the entity path', () => {
    const file = ['public/collect.js', 'apps/web-app/public/collect.js']
      .map((item) => resolve(process.cwd(), item))
      .find((item) => existsSync(item))
    expect(file).toBeTruthy()
    const bytes = readFileSync(file || '')
    expect(bytes.length).toBeLessThan(2048)
    expect(bytes.toString('utf8')).toContain('data-track-entity')
    expect(COLLECT_TYPES).toEqual(expect.arrayContaining(['directions', 'pin_impression', 'pin_click']))
  })

  it('stores the pin entity and keeps the page route', () => {
    expect(
      mergeHitEntities(
        { placeId: 'place-page', routeId: 'route-1', venueId: null },
        { placeId: null, routeId: null, venueId: 'venue-1' },
        null,
      ),
    ).toEqual({ placeId: 'place-page', routeId: 'route-1', venueId: 'venue-1' })
    expect(
      mergeHitEntities(
        { placeId: null, routeId: 'route-1', venueId: null },
        { placeId: 'stop-place', routeId: null, venueId: null },
        null,
      ),
    ).toEqual({ placeId: 'stop-place', routeId: 'route-1', venueId: null })
  })
})

describe('search console property', () => {
  it('falls back from a URL prefix to the domain property it can read', async () => {
    const { pickGoogleSite } = await import('../server/utils/analytics/search-job')
    const sites = [{ siteUrl: 'sc-domain:k39.online', permissionLevel: 'siteFullUser' }]
    expect(pickGoogleSite('https://k39.online/', sites)).toBe('sc-domain:k39.online')
    expect(pickGoogleSite('sc-domain:k39.online', sites)).toBe('sc-domain:k39.online')
    expect(pickGoogleSite('https://k39.online/', [])).toBe('https://k39.online/')
  })

  it('asks Yandex for a lagged week and the verified host', async () => {
    const { pickYandexHost, yandexFallbackWindow, yandexPopularUrl, yandexQueryRows, yandexQueryWindow } =
      await import('../server/utils/analytics/search-job')
    const now = new Date('2026-10-16T15:00:00Z')
    expect(yandexQueryWindow(now, false)).toEqual({ from: '2026-10-07', to: '2026-10-13' })
    expect(yandexQueryWindow(now, true)).toEqual({ from: '2026-09-16', to: '2026-10-13' })
    expect(yandexFallbackWindow('2026-10-07')).toEqual({ from: '2026-09-30', to: '2026-10-06' })
    const hosts = [
      {
        host_id: 'https:k39.online:443',
        unicode_host_url: 'https://k39.online/',
        ascii_host_url: 'https://k39.online/',
        verified: true,
      },
    ]
    expect(pickYandexHost('https:k39.online:443', hosts)).toBe('https:k39.online:443')
    expect(pickYandexHost('https://k39.online/', hosts)).toBe('https:k39.online:443')
    expect(pickYandexHost('http:k39.online:80', hosts)).toBe('https:k39.online:443')
    const url = yandexPopularUrl('42', 'https:k39.online:443', '2026-10-07', '2026-10-13', 0)
    expect(url.pathname.endsWith('/search-queries/popular/')).toBe(true)
    expect(url.searchParams.get('order_by')).toBe('TOTAL_SHOWS')
    expect(url.searchParams.get('date_to')).toBe('2026-10-13')
    expect(
      yandexQueryRows(
        {
          date_to: '2026-10-13T00:00:00.000+03:00',
          queries: [
            { query_text: 'форт 11', indicators: { TOTAL_SHOWS: 12, TOTAL_CLICKS: 2, AVG_SHOW_POSITION: 4.5 } },
          ],
        },
        '2026-10-16',
      ),
    ).toEqual([
      {
        day: '2026-10-13',
        engine: 'yandex',
        page: '',
        query: 'форт 11',
        impressions: 12,
        clicks: 2,
        position: 4.5,
      },
    ])
  })
})
