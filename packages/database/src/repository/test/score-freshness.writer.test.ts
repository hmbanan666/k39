import { eq, inArray } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { saveSchedule } from '../../../../../apps/web-app/server/utils/schedule'
import { previewContentScore, refreshContentScores } from '../../../../../apps/web-app/server/utils/scoring/run'
import { scheduleRulesSchema } from '../../../../../apps/web-app/shared/schedule'
import { issueLabel } from '../../../../../apps/web-app/shared/score-labels'
import { useDatabase } from '../../database'
import { contentScoreDays, contentScores, facts, places, schedules } from '../../tables'
import { Editor } from '../content'
import { Facts } from '../facts'
import { Scoring } from '../scoring'

const ids: string[] = []
const now = () => new Date().toISOString()
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

afterEach(async () => {
  const db = useDatabase()
  await db.delete(contentScoreDays)
  await db.delete(contentScores)
  await db.delete(facts).where(inArray(facts.subjectId, ids))
  await db.delete(schedules).where(inArray(schedules.entityId, ids))
  await db.delete(places).where(inArray(places.id, ids))
  ids.length = 0
})

async function fixture(suffix: string, needsCheck: boolean, verifiedAt = now()) {
  const place = await Editor.savePlace({
    slug: `fixture-score-freshness-${suffix}`, title: `Локальная проверка ${suffix}`,
    summary: 'Локальная фикстура, не статья.', body: 'Локальная проверка сигнала.',
    publicationStatus: 'published', lastVerifiedAt: now(), price: 'Вход бесплатный',
  })
  ids.push(place.id)
  await saveSchedule('place', place.id, {
    rules: scheduleRulesSchema.parse({ mode: 'hours', seasons: [{ week: [{ days: [0, 1, 2, 3, 4, 5, 6], opens: '10:00', closes: '18:00' }] }], needsCheck }),
    sourceUrl: 'https://example.org/hours', verifiedAt,
  }, { actor: 'editor', pageStatus: 'published' })
  return place
}

async function preview(place: Awaited<ReturnType<typeof fixture>>) {
  const result = await previewContentScore(`/${place.slug}`)
  expect(result).not.toBeNull()
  return result!
}

describe('schedule uncertainty and fact ages through real readers and writers', () => {
  it('labels fresh needsCheck as schedule uncertainty, preserves the sibling penalty and populates the page age', async () => {
    const uncertain = await fixture('uncertain', true)
    const certain = await fixture('certain', false)
    const catalog = await Scoring.loadCatalog()
    expect(catalog.places.find((row) => row.id === uncertain.id)?.factsCheckedAt).toContain(now().slice(0, 10))
    const uncertainFact = await Facts.liveSlot('place', uncertain.id, 'hours')
    expect(uncertainFact?.checkedAt).toBeNull()
    const before = await useDatabase().select().from(schedules).where(eq(schedules.entityId, uncertain.id))
    const score = await preview(uncertain)
    const sibling = await preview(certain)
    expect(score.checks.quality).toContain('schedule needs check')
    expect(score.checks.quality).not.toContain('stale facts')
    expect(score.signals.factsAgeDays).toBe(0)
    expect(sibling.signals.factsAgeDays).toBe(0)
    expect(sibling.checks.quality).not.toContain('schedule needs check')
    expect(sibling.checks.quality).not.toContain('stale facts')
    expect(sibling.quality - score.quality).toBe(15)
    expect(issueLabel('schedule needs check')).toBe('Режим работы требует проверки')
    expect(await Scoring.scoreByPath(`/${uncertain.slug}`)).toBeNull()
    await refreshContentScores({ force: true })
    const stored = await Scoring.scoreByPath(`/${uncertain.slug}`)
    expect(stored?.checks).toEqual(score.checks)
    expect(stored?.signals.factsAgeDays).toBe(0)
    expect(stored?.quality).toBe(score.quality)
    expect(await useDatabase().select().from(schedules).where(eq(schedules.entityId, uncertain.id))).toEqual(before)
    expect((await Facts.liveSlot('place', uncertain.id, 'hours'))?.checkedAt).toBeNull()
  })

  it('keeps the canonical 30-day hours TTL even on a freshly checked page', async () => {
    const expired = await fixture('expired', false, daysAgo(31))
    const score = await preview(expired)
    expect(score.checks.quality).toContain('stale facts')
    expect(score.checks.quality).not.toContain('schedule needs check')
    expect(score.signals.factsAgeDays).toBe(0)
  })

  it('reports age expiry and schedule uncertainty together without another freshness deduction', async () => {
    const uncertain = await fixture('both', true)
    const sibling = await fixture('both-control', false)
    const before = await preview(uncertain)
    await Facts.upsert({
      kind: 'phone', subjectType: 'place', subjectId: uncertain.id, slot: 'phone',
      value: { text: '+7 4012 000000' }, valueHash: 'b'.repeat(64), sourceKind: 'official',
      sourceUrl: 'https://example.org/phone', sourceTitle: null,
      checkedAt: daysAgo(181), ttlDays: 180, confidence: 'stated', actor: 'editor',
    }, [{ consumerType: 'place', consumerId: uncertain.id, path: 'short.phone' }])
    const score = await preview(uncertain)
    expect(score.checks.quality).toContain('schedule needs check')
    expect(score.checks.quality).toContain('stale facts')
    expect(score.quality).toBe(before.quality)
    expect((await preview(sibling)).quality - score.quality).toBe(15)
  })

  it('keeps a missing check date explicit without treating it as age expiry', async () => {
    const place = await fixture('unchecked', false)
    await Facts.upsert({
      kind: 'phone', subjectType: 'place', subjectId: place.id, slot: 'phone',
      value: { text: '+7 4012 000000' }, valueHash: 'c'.repeat(64), sourceKind: 'official',
      sourceUrl: 'https://example.org/phone', sourceTitle: null,
      checkedAt: null, ttlDays: 180, confidence: 'stated', actor: 'editor',
    }, [{ consumerType: 'place', consumerId: place.id, path: 'short.phone' }])
    const score = await preview(place)
    expect(score.checks.quality).toContain('facts not checked')
    expect(score.checks.quality).not.toContain('stale facts')
    expect(score.signals.factsAgeDays).toBe(0)
    expect((await Facts.freshnessByConsumer(now())).find((row) => row.consumer_id === place.id)?.stale).toBe(1)
  })

  it.each(['source_changed', 'owner_conflict', 'source_gone'])('keeps an unresolved %s explicit without calling fresh evidence old', async (reason) => {
    const place = await fixture(reason, false)
    const fact = await Facts.liveSlot('place', place.id, 'hours')
    await Facts.enqueue({ target: 'fact', factId: fact!.id, reason, pageType: 'place', entityId: place.id, path: 'short.hours' })
    const score = await preview(place)
    expect(score.checks.quality).toContain('facts need review')
    expect(score.checks.quality).not.toContain('stale facts')
    expect(score.signals.factsAgeDays).toBe(0)
    const freshness = (await Facts.freshnessByConsumer(now())).find((row) => row.consumer_id === place.id)
    expect(freshness?.stale).toBe(1)
  })
})
