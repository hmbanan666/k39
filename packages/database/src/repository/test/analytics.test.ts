import { describe, expect, it } from 'vitest'
import { Analytics } from '../analytics'

describe('analytics store', () => {
  it('counts visitors, a bounce, and a rollup', async () => {
    const now = new Date()
    const day = now.toISOString().slice(0, 10)
    await Analytics.insertHits([
      {
        visitorKey: 'visitor-a',
        visitorMode: 'daily',
        sessionKey: 'session-a',
        consented: false,
        isBot: false,
        eventType: 'pageview',
        path: '/zamok-ragnit',
        channel: 'organic:yandex',
        referrerHost: 'yandex.ru',
        isEntry: true,
        isExit: true,
        landingPath: '/zamok-ragnit',
        occurredAt: now.toISOString(),
      },
      {
        visitorKey: 'visitor-b',
        visitorMode: 'cookie',
        sessionKey: 'session-b',
        consented: true,
        isBot: false,
        eventType: 'pageview',
        path: '/zamok-ragnit',
        channel: 'direct',
        isEntry: true,
        isExit: false,
        landingPath: '/zamok-ragnit',
        occurredAt: now.toISOString(),
      },
      {
        visitorKey: 'visitor-b',
        visitorMode: 'cookie',
        sessionKey: 'session-b',
        consented: true,
        isBot: false,
        eventType: 'pageview',
        path: '/forty',
        channel: 'internal',
        isEntry: false,
        isExit: true,
        landingPath: '/zamok-ragnit',
        engagedMs: 20000,
        occurredAt: now.toISOString(),
      },
      {
        visitorKey: 'bot',
        visitorMode: 'daily',
        sessionKey: 'session-bot',
        consented: false,
        isBot: true,
        eventType: 'pageview',
        path: '/zamok-ragnit',
        channel: 'direct',
        occurredAt: now.toISOString(),
      },
    ])
    const from = new Date(now.getTime() - 60_000)
    const to = new Date(now.getTime() + 60_000)
    const overview = await Analytics.overview(from, to)
    expect(overview.visitors).toBe(2)
    expect(overview.pageviews).toBe(3)
    expect(overview.sessions).toBe(2)
    expect(overview.bounceRate).toBe(50)
    const page = await Analytics.pageReport('zamok-ragnit', from, to)
    expect(page.pageviews).toBeGreaterThan(0)
    await Analytics.rollupDay(day)
    const claimed = await Analytics.claimRun(day, 'rollup-test')
    expect(claimed).toBe(true)
    expect(await Analytics.claimRun(day, 'rollup-test')).toBe(false)
    await Analytics.replaceSearchRows([
      {
        day,
        engine: 'google',
        page: '/zamok-ragnit',
        query: 'замок рагнит',
        impressions: 10,
        clicks: 2,
        position: 3.5,
      },
    ])
    const queries = await Analytics.searchQueries(from, to, 'google', '/zamok-ragnit')
    expect(queries[0]?.query).toBe('замок рагнит')
    expect(queries[0]?.clicks).toBe(2)
  })
})
