import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dailyVisitorKey } from '../server/utils/analytics/identity'
import { classifyChannel, isBotUserAgent, parseUserAgent, resolvePeriod, screenBucket, searchQueryFromReferrer, trendPercent } from '../shared/analytics'

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

  it('keeps the beacon under 2 KB', () => {
    const file = ['public/collect.js', 'apps/web-app/public/collect.js']
      .map((item) => resolve(process.cwd(), item))
      .find((item) => existsSync(item))
    expect(file).toBeTruthy()
    const bytes = readFileSync(file || '').length
    expect(bytes).toBeLessThan(2048)
  })
})
