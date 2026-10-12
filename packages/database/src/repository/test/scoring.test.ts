import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDatabase } from '../../database'
import { applyInitialContent } from '../../seed/apply'
import { analyticsSearchQueries, categories, collectionItems, collections, contentImports, contentScoreDays, contentScores, media, offerCodes, offers, pagePassports, placeMedia, places, quests, questSteps, regions, relatedLinks, revisions, routePoints, routes } from '../../tables'
import { Analytics } from '../analytics'
import { Scoring } from '../scoring'

async function wipe() {
  const db = useDatabase()
  await db.delete(contentScoreDays)
  await db.delete(contentScores)
  await db.delete(pagePassports)
  await db.delete(analyticsSearchQueries)
  await db.delete(offerCodes)
  await db.delete(offers)
  await db.delete(questSteps)
  await db.delete(routePoints)
  await db.delete(collectionItems)
  await db.delete(relatedLinks)
  await db.delete(placeMedia)
  await db.delete(revisions)
  await db.delete(quests)
  await db.delete(routes)
  await db.delete(collections)
  await db.delete(media)
  await db.delete(places)
  await db.delete(categories)
  await db.delete(regions)
  await db.delete(contentImports)
}

describe('content scores', () => {
  beforeEach(async () => {
    await wipe()
  })

  it('loads the seeded catalog and keeps a passport on its page', async () => {
    await applyInitialContent()
    const catalog = await Scoring.loadCatalog()
    const fort = catalog.places.find((place) => place.slug === 'fort-11-denhoff')
    expect(fort?.categorySlug).toBe('forty')
    expect(catalog.hubs.some((hub) => hub.slug === 'forty')).toBe(true)
    await useDatabase().update(categories).set({
      body: '## Частые вопросы\n\n### Можно ли зайти?\n\nДа, смотрите статус на странице форта.',
    }).where(eq(categories.slug, 'forty'))
    const withBody = await Scoring.loadCatalog()
    expect(withBody.hubs.find((hub) => hub.slug === 'forty')?.body).toContain('### Можно ли зайти?')
    expect(catalog.routes.some((route) => route.slug === 'pyat-fortov')).toBe(true)
    const saved = await Scoring.upsertPassport({
      pageType: 'place',
      entityId: fort!.id,
      path: '/fort-11-denhoff',
      targetQueries: ['форт 11'],
      audience: 'семьи',
      primaryAction: 'claim_offer',
      goal30d: 20,
      goal90d: 80,
      notes: 'пилот',
    })
    expect(saved?.primaryAction).toBe('claim_offer')
    const again = await Scoring.upsertPassport({
      pageType: 'place',
      entityId: fort!.id,
      path: '/fort-11-denhoff',
      goal30d: 25,
    })
    expect(again?.goal30d).toBe(25)
    expect(again?.audience).toBe('семьи')
    const reloaded = await Scoring.loadCatalog()
    expect(reloaded.passports[0]?.targetQueries).toEqual(['форт 11'])
  })

  it('stores a day snapshot and finds the week-ago row', async () => {
    const row = {
      pageType: 'place' as const,
      entityId: 'place-1',
      path: '/fort-a',
      title: 'Форт А',
      total: 40,
      quality: 30,
      linking: 50,
      indexing: 60,
      results: 20,
      checks: { quality: ['no FAQ'], linking: ['orphan'], indexing: [], results: [] },
      signals: { organic30d: 1, organic90d: 2, goal30d: 10, goal90d: 30 },
      organic30d: 1,
      organic90d: 2,
      goal30d: 10,
      goal90d: 30,
    }
    await Scoring.replaceScores([row])
    await Scoring.upsertDays('2026-10-05', [{ ...row, total: 55 }])
    await Scoring.upsertDays('2026-10-12', [row])
    expect(await Scoring.latestDayOnOrBefore('2026-10-05')).toBe('2026-10-05')
    const previous = await Scoring.scoresForDay('2026-10-05')
    expect(previous[0]?.total).toBe(55)
    const current = await Scoring.listScores()
    expect(current[0]?.checks.quality).toEqual(['no FAQ'])
    expect(current[0]?.organic30d).toBe(1)
    await Scoring.deleteStalePassports([])
    await Scoring.upsertPassport({ pageType: 'place', entityId: 'gone', path: '/gone' })
    await Scoring.deleteStalePassports([{ pageType: 'place', entityId: 'place-1' }])
    const left = await useDatabase().select().from(pagePassports)
    expect(left).toEqual([])
  })

  it('counts organic entrances separately from direct visits', async () => {
    const now = new Date()
    await Analytics.insertHits([
      {
        visitorKey: 'visitor-a',
        visitorMode: 'daily',
        sessionKey: 'session-a',
        consented: false,
        isBot: false,
        eventType: 'pageview',
        path: '/score-probe',
        channel: 'organic:yandex',
        isEntry: true,
        landingPath: '/score-probe',
        occurredAt: now.toISOString(),
      },
      {
        visitorKey: 'visitor-a',
        visitorMode: 'daily',
        sessionKey: 'session-a',
        consented: false,
        isBot: false,
        eventType: 'pageview',
        path: '/score-next',
        channel: 'internal',
        isEntry: false,
        occurredAt: new Date(now.getTime() + 1000).toISOString(),
      },
      {
        visitorKey: 'visitor-b',
        visitorMode: 'daily',
        sessionKey: 'session-b',
        consented: false,
        isBot: false,
        eventType: 'pageview',
        path: '/score-probe',
        channel: 'direct',
        isEntry: true,
        occurredAt: now.toISOString(),
      },
      {
        visitorKey: 'visitor-a',
        visitorMode: 'daily',
        sessionKey: 'session-a',
        consented: false,
        isBot: false,
        eventType: 'engage',
        path: '/score-probe',
        channel: 'organic:yandex',
        engagedMs: 20000,
        scrollBucket: '75',
        occurredAt: now.toISOString(),
      },
      {
        visitorKey: 'visitor-a',
        visitorMode: 'daily',
        sessionKey: 'session-a',
        consented: false,
        isBot: false,
        eventType: 'outbound',
        path: '/score-probe',
        channel: 'organic:yandex',
        target: 'route',
        occurredAt: now.toISOString(),
      },
    ])
    const metrics = await Scoring.pageMetrics(new Date(now.getTime() + 60_000))
    const fort = metrics.find((row) => row.path === '/score-probe')
    expect(fort?.organic30d).toBe(1)
    expect(fort?.pageviews30d).toBe(2)
    expect(fort?.continuations).toBe(1)
    expect(fort?.outboundClicks).toBe(1)
    expect(fort?.scrollMax).toBe(75)
    expect(await Scoring.searchImported()).toBe(false)
  })
})
