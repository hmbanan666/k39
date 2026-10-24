// Lives in the database suite so it uses that Postgres.
// Typechecked from apps/web-app/tsconfig.writer-test.json, where Nuxt
// auto-imports exist. This package's tsc excludes the file.
import type { AdmissionExtraInput, AdmissionRowInput } from '../../../../../apps/web-app/server/utils/practical/admission'
import type { VenueStatus } from '../../venues'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enterContentScope } from '../../../../../apps/web-app/server/utils/access'
import { updateFact } from '../../../../../apps/web-app/server/utils/mcp/fact-write'
import { readAdmission, setAdmission } from '../../../../../apps/web-app/server/utils/practical/admission'
import { retirePastEvents, upsertEvent } from '../../../../../apps/web-app/server/utils/practical/events'
import { loadAdmission, loadMemberEvents, loadSubjectEvents } from '../../../../../apps/web-app/server/utils/practical/public'
import { practicalTarget } from '../../../../../apps/web-app/server/utils/practical/target'
import { scoresFromCatalog, toStored } from '../../../../../apps/web-app/server/utils/scoring/assemble'
import { scorePreview } from '../../../../../apps/web-app/server/utils/scoring/preview'
import { admissionFree } from '../../../../../apps/web-app/shared/admission'
import { useDatabase } from '../../database'
import { resolveMigrationsFolder } from '../../migrations'
import { admissionPrices, calendarEvents, collections, contentDrafts, contentScores, facts, places, routes, venues, verificationQueue } from '../../tables'
import { Editor } from '../content'
import { Facts } from '../facts'
import { CalendarEvents } from '../practical'
import { Scoring } from '../scoring'

const placeIds: string[] = []
const venueIds: string[] = []
const routeIds: string[] = []
const collectionIds: string[] = []

beforeEach(() => {
  vi.stubEnv('FEATURE_ADMISSION_EXTRAS_WRITE', 'true')
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  enterContentScope('editor')
  const database = useDatabase()
  for (const id of [...placeIds, ...venueIds, ...routeIds, ...collectionIds]) {
    await database.delete(verificationQueue).where(eq(verificationQueue.entityId, id))
    await database.delete(facts).where(eq(facts.subjectId, id))
    await database.delete(admissionPrices).where(eq(admissionPrices.subjectId, id))
    await database.delete(calendarEvents).where(eq(calendarEvents.subjectId, id))
    await database.delete(contentDrafts).where(eq(contentDrafts.entityId, id))
    await database.delete(contentScores).where(eq(contentScores.entityId, id))
  }
  for (const id of collectionIds) {
    await database.delete(collections).where(eq(collections.id, id))
  }
  for (const id of routeIds) {
    await database.delete(routes).where(eq(routes.id, id))
  }
  for (const id of placeIds) {
    await database.delete(places).where(eq(places.id, id))
  }
  for (const id of venueIds) {
    await database.delete(venues).where(eq(venues.id, id))
  }
  placeIds.length = 0
  venueIds.length = 0
  routeIds.length = 0
  collectionIds.length = 0
})

const SOURCE = { sourceUrl: 'https://museum.example/tickets', sourceTitle: 'Музей: цены', checkedAt: new Date().toISOString().slice(0, 10) }

function row(slot: string, patch: Partial<AdmissionRowInput> = {}): AdmissionRowInput {
  return { slot, audience: 'general', priceRub: 400, ...SOURCE, ...patch }
}

async function place(slug: string, publicationStatus: 'draft' | 'review' | 'published' | 'archived' = 'draft') {
  const saved = await Editor.savePlace({ slug, title: `Проверка ${slug}`, summary: 'Проверка.', body: 'Проверка.', status: 'unknown', publicationStatus, sources: [] })
  placeIds.push(saved.id)
  return practicalTarget('place', saved.id)
}

async function venue(slug: string, status: VenueStatus, social: { socials?: Array<{ network: 'vk', url: string }>, vkCommunityId?: number } = {}) {
  const [saved] = await useDatabase().insert(venues).values({ slug, name: `Кафе ${slug}`, kind: 'cafe', description: 'Короткое описание.', status, ...social }).returning()
  venueIds.push(saved!.id)
  return practicalTarget('venue', saved!.id)
}

async function route(slug: string, publicationStatus: 'draft' | 'published') {
  await Editor.saveRoute({ slug, title: `Маршрут ${slug}`, body: 'Проверка.', publicationStatus })
  const saved = await Editor.routeBySlug(slug)
  routeIds.push(saved!.id)
  return practicalTarget('route', saved!.id)
}

function inDays(days: number) {
  const date = new Date(Date.now() + days * 86_400_000)
  return date.toISOString().slice(0, 10)
}

async function status(promise: Promise<unknown>) {
  try {
    await promise
    return 200
  } catch (error) {
    return (error as { statusCode?: number }).statusCode ?? 500
  }
}

describe('admission writer', () => {
  it('preserves collection price credit after copied amounts are removed when a member has fresh entry data', async () => {
    const target = await place('collection-admission-member', 'published')
    await setAdmission(target, [row('general')], 'editor')
    const body = 'Площадь у реки находится возле старого квартала. '.repeat(120)
    const collection = await Editor.saveCollection({
      slug: 'collection-admission-evidence', title: 'Прогулка по кварталам', body: `${body}\n\n400 ₽.`,
      publicationStatus: 'published', items: [{ placeSlug: target.slug }],
    })
    collectionIds.push(collection.id)
    const copied = scoresFromCatalog(await Scoring.loadCatalog(), [], [], false).find((score) => score.entityId === collection.id)!
    expect(copied.checks.quality).not.toContain('no prices')
    await Editor.saveCollection({ id: collection.id, slug: collection.slug, title: collection.title, body })
    const catalog = await Scoring.loadCatalog()
    const score = scoresFromCatalog(catalog, [], [], false).find((score) => score.entityId === collection.id)!
    expect(score.checks.quality).not.toContain('no prices')
    expect(score.quality).toBe(copied.quality)
    expect(scorePreview({ catalog, pageType: 'collection', entityId: collection.id, source: 'live', publicationStatus: 'published' })?.checks.quality).toEqual(score.checks.quality)
    await Scoring.replaceScores([toStored(score)])
    expect((await Scoring.listScores()).find((stored) => stored.entityId === collection.id)?.checks.quality).toEqual(score.checks.quality)
  })

  it.each([
    { label: 'fresh paid', rows: [row('adult')], evidence: true, shown: 1, free: false },
    { label: 'fresh free', rows: [row('free', { audience: 'free', priceRub: 0 })], evidence: true, shown: 1, free: true },
    { label: 'conditional free only', rows: [row('free', { audience: 'free', priceRub: 0, condition: 'Дети до семи лет' })], evidence: true, shown: 1, free: null },
    { label: 'freshness boundary', rows: [row('adult', { checkedAt: inDays(-365) })], evidence: true, shown: 1, free: false },
    { label: 'unknown', rows: [], evidence: false, shown: 0, free: null },
    { label: 'stale paid', rows: [row('adult', { checkedAt: inDays(-366) })], evidence: false, shown: 0, free: null },
    { label: 'stale free', rows: [row('free', { audience: 'free', priceRub: 0, checkedAt: inDays(-366) })], evidence: false, shown: 0, free: null },
    { label: 'draft member', rows: [row('adult')], status: 'draft' as const, evidence: false, shown: 1, free: false },
    { label: 'review member', rows: [row('adult')], status: 'review' as const, evidence: false, shown: 1, free: false },
    { label: 'archived member', rows: [row('adult')], status: 'archived' as const, evidence: false, shown: 1, free: false },
    { label: 'extras only', rows: [], extra: true, evidence: false, shown: 0, free: null },
    { label: 'stale entry and fresh extra', rows: [row('adult', { checkedAt: inDays(-366) })], extra: true, evidence: false, shown: 0, free: null },
    { label: 'paid entry and extra', rows: [row('adult')], extra: true, evidence: true, shown: 1, free: false },
    { label: 'invalid map source', rows: [row('adult', { sourceUrl: 'https://yandex.ru/maps/org/1' })], rejected: true, evidence: false, shown: 0, free: null },
  ])('uses canonical member entry evidence for collections: $label', async (test) => {
    const target = await place('collection-entry-member', 'published')
    const input = {
      rows: test.rows,
      extras: test.extra ? [{ slot: 'audio', label: 'Аудиогид', priceRub: 200, unit: 'device' as const, ...SOURCE }] : [],
    }
    if (test.rejected) {
      await expect(setAdmission(target, input, 'editor')).rejects.toMatchObject({ statusCode: 400 })
    } else {
      await setAdmission(target, input, 'editor')
    }
    const collection = await Editor.saveCollection({
      slug: 'collection-entry-edges', title: 'Прогулка по кварталам', body: 'Дома стоят возле реки.',
      publicationStatus: 'published', items: [{ placeSlug: target.slug }],
    })
    collectionIds.push(collection.id)
    if (test.status) {
      await useDatabase().update(places).set({ publicationStatus: test.status }).where(eq(places.id, target.id))
    }
    const view = await loadAdmission('place', target.id)
    expect(view.rows).toHaveLength(test.shown)
    expect(admissionFree(view)).toBe(test.free)
    const catalog = await Scoring.loadCatalog()
    const score = scoresFromCatalog(catalog, [], [], false).find((score) => score.entityId === collection.id)!
    expect(score.checks.quality.includes('no prices')).toBe(!test.evidence)
    const preview = scorePreview({ catalog, pageType: 'collection', entityId: collection.id, source: 'live', publicationStatus: 'published' })
    expect(preview?.checks.quality).toEqual(toStored(score).checks.quality)
  })

  it('uses only members and accepts partial evidence without asserting that unknown members are free', async () => {
    const unknown = await place('collection-unknown', 'published')
    const known = await place('collection-known', 'published')
    await setAdmission(known, [row('adult')], 'editor')
    const collection = await Editor.saveCollection({
      slug: 'collection-members-only', title: 'Прогулка по кварталам', body: 'Дома стоят возле реки.',
      publicationStatus: 'published', items: [{ placeSlug: unknown.slug }],
    })
    collectionIds.push(collection.id)
    let catalog = await Scoring.loadCatalog()
    expect(scoresFromCatalog(catalog, [], [], false).find((score) => score.entityId === collection.id)?.checks.quality).toContain('no prices')
    await Editor.saveCollection({ id: collection.id, slug: collection.slug, title: collection.title, items: [{ placeSlug: unknown.slug }, { placeSlug: known.slug }] })
    catalog = await Scoring.loadCatalog()
    expect(scoresFromCatalog(catalog, [], [], false).find((score) => score.entityId === collection.id)?.checks.quality).not.toContain('no prices')
    expect((await loadAdmission('place', unknown.id)).rows).toEqual([])
    expect(admissionFree(await loadAdmission('place', unknown.id))).toBeNull()
  })

  it('validates audience rules, free at zero, the row cap, and the official source', async () => {
    const target = await place('practical-validate')
    expect(await status(setAdmission(target, Array.from({ length: 49 }, (_, index) => row(`r${index}`)), 'mcp'))).toBe(400)
    expect(await status(setAdmission(target, [row('a'), row('a')], 'mcp'))).toBe(400)
    expect(await status(setAdmission(target, [row('Bad Slot')], 'mcp'))).toBe(400)
    expect(await status(setAdmission(target, [row('reduced', { audience: 'reduced' })], 'mcp'))).toBe(400)
    expect(await status(setAdmission(target, [row('family', { audience: 'family' })], 'mcp'))).toBe(400)
    expect(await status(setAdmission(target, [row('foreign', { audience: 'foreign' })], 'mcp'))).toBe(400)
    expect(await status(setAdmission(target, [row('free', { audience: 'free', priceRub: 100 })], 'mcp'))).toBe(400)
    expect(await status(setAdmission(target, [row('zero', { priceRub: 0 })], 'mcp'))).toBe(400)
    expect(await status(setAdmission(target, [row('map', { sourceUrl: 'https://yandex.ru/maps/org/123' })], 'mcp'))).toBe(400)
    expect(await status(setAdmission(target, [row('gis', { sourceUrl: 'https://2gis.ru/kaliningrad/firm/1' })], 'mcp'))).toBe(400)
    expect(await status(setAdmission(target, [row('agg', { sourceUrl: 'https://www.afisha.ru/museum/1' })], 'mcp'))).toBe(400)
    expect(await status(setAdmission(target, [row('vk', { sourceUrl: 'https://vk.com/museum' })], 'mcp'))).toBe(400)
    expect(await status(setAdmission(target, [row('drive', { sourceUrl: 'https://drive.google.com/file/d/1' })], 'mcp'))).toBe(400)
    expect(await status(setAdmission(target, [row('future', { checkedAt: inDays(5) })], 'mcp'))).toBe(400)
    expect(await useDatabase().select().from(admissionPrices).where(eq(admissionPrices.subjectId, target.id))).toHaveLength(0)

    const saved = await setAdmission(target, [
      row('kids', { audience: 'free', priceRub: 0, condition: 'Дети до 7 лет' }),
      row('adult'),
      row('reduced', { audience: 'reduced', priceRub: 200, condition: 'Пенсионеры' }),
      row('everyone', { audience: 'free', priceRub: 0 }),
    ], 'mcp')
    expect(saved.rows.map((item) => item.slot)).toEqual(['adult', 'reduced', 'kids', 'everyone'])
  })

  it('writes one fact per row and retires the fact of a row left out', async () => {
    const target = await place('practical-facts')
    await setAdmission(target, [row('adult'), row('reduced', { audience: 'reduced', priceRub: 200, condition: 'Студенты' })], 'mcp')
    const adult = await Facts.liveSlot('place', target.id, 'admission:adult')
    expect(adult?.kind).toBe('admission')
    expect(adult?.value).toEqual({ audience: 'general', priceRub: 400, condition: null, label: null })
    expect(adult?.sourceKind).toBe('official')

    await setAdmission(target, [row('adult', { priceRub: 450 })], 'mcp')
    expect((await Facts.liveSlot('place', target.id, 'admission:adult'))?.value).toMatchObject({ priceRub: 450 })
    expect(await Facts.liveSlot('place', target.id, 'admission:reduced')).toBeNull()

    await setAdmission(target, [], 'mcp')
    expect(await Facts.liveSlot('place', target.id, 'admission:adult')).toBeNull()
  })

  it('refuses the draft token on a live parent and stores nothing pending', async () => {
    const live = await place('practical-live', 'published')
    const archived = await place('practical-archived', 'archived')
    const draftPlace = await place('practical-draft-ok', 'review')
    const liveVenue = await venue('practical-venue-live', 'published')
    const closedVenue = await venue('practical-venue-closed', 'closed')
    const liveRoute = await route('practical-route-live', 'published')
    enterContentScope('draft')
    for (const target of [live, archived, liveVenue, closedVenue, liveRoute]) {
      const result = await setAdmission(target, [row('adult')], 'mcp').catch((error: { statusCode: number, statusMessage: string }) => error)
      expect(result).toMatchObject({ statusCode: 409 })
      expect((result as { statusMessage: string }).statusMessage).toContain('The live page was not changed')
      expect(await useDatabase().select().from(admissionPrices).where(eq(admissionPrices.subjectId, target.id))).toHaveLength(0)
      expect(await useDatabase().select().from(contentDrafts).where(eq(contentDrafts.entityId, target.id))).toHaveLength(0)
    }
    expect((await setAdmission(draftPlace, [row('adult')], 'mcp')).rows).toHaveLength(1)
    enterContentScope('editor')
    expect((await setAdmission(live, [row('adult')], 'editor')).rows).toHaveLength(1)
  })

  it('routes fact_update through the row writer with the same live-parent rule', async () => {
    const target = await place('practical-fact-update', 'published')
    await setAdmission(target, [row('adult')], 'editor')
    const fact = await Facts.liveSlot('place', target.id, 'admission:adult')
    enterContentScope('draft')
    expect(await status(updateFact({ id: fact!.id, value: { audience: 'general', priceRub: 500, condition: null, label: null }, sourceUrl: SOURCE.sourceUrl, sourceKind: 'official', confidence: 'stated' }))).toBe(409)
    enterContentScope('editor')
    await updateFact({ id: fact!.id, value: { audience: 'general', priceRub: 500, condition: null, label: null }, sourceUrl: SOURCE.sourceUrl, sourceKind: 'official', confidence: 'stated' })
    const [stored] = await useDatabase().select().from(admissionPrices).where(eq(admissionPrices.subjectId, target.id))
    expect(stored?.priceRub).toBe(500)
    expect((await Facts.liveSlot('place', target.id, 'admission:adult'))?.value).toMatchObject({ priceRub: 500 })
  })

  it('hides a stale row but keeps it stored, so places.price is not shown', async () => {
    const target = await place('practical-stale')
    await useDatabase().insert(admissionPrices).values({ subjectType: 'place', subjectId: target.id, slot: 'adult', audience: 'general', priceRub: 300, sourceUrl: SOURCE.sourceUrl, sourceTitle: SOURCE.sourceTitle, checkedAt: inDays(-400) })
    const view = await loadAdmission('place', target.id)
    expect(view.stored).toBe(true)
    expect(view.rows).toHaveLength(0)
  })
})

describe('event writer', () => {
  it('reads local Kaliningrad time, writes the fact, and cancels with remove', async () => {
    const target = await place('practical-events')
    const day = inDays(20)
    const saved = await upsertEvent(target, { event: { title: 'Органный вечер', startsAt: `${day}T19:00`, endsAt: `${day}T21:00`, ticketUrl: 'https://tickets.example/organ', ...SOURCE, sourceUrl: 'https://museum.example/afisha' } }, 'mcp')
    expect(saved.event?.startsAt && new Date(saved.event.startsAt).toISOString()).toBe(`${day}T17:00:00.000Z`)
    const fact = await Facts.liveSlot('place', target.id, `event:${saved.event!.id}`)
    expect(fact?.value).toMatchObject({ title: 'Органный вечер', allDay: false, ticketUrl: 'https://tickets.example/organ' })

    const allDay = await upsertEvent(target, { event: { title: 'День музея', allDay: true, startsOn: day, ...SOURCE } }, 'mcp')
    expect(new Date(allDay.event!.startsAt).toISOString()).toBe(`${inDays(19)}T22:00:00.000Z`)
    expect(new Date(allDay.event!.endsAt!).toISOString()).toBe(`${day}T22:00:00.000Z`)

    const removed = await upsertEvent(target, { id: saved.event!.id, remove: true }, 'mcp')
    expect(removed.event?.cancelledAt).toBeTruthy()
    expect(await Facts.liveSlot('place', target.id, `event:${saved.event!.id}`)).toBeNull()
    expect((await loadSubjectEvents('place', target.id)).lines.map((line) => line.title)).toEqual(['День музея'])
  })

  it('rejects a past event, a guessed clock, a listing source, and a route subject', async () => {
    const target = await place('practical-events-invalid')
    expect(await status(upsertEvent(target, { event: { title: 'Прошло', startsAt: `${inDays(-2)}T19:00`, ...SOURCE } }, 'mcp'))).toBe(400)
    expect(await status(upsertEvent(target, { event: { title: 'Дата', allDay: true, startsAt: `${inDays(3)}T19:00`, ...SOURCE } }, 'mcp'))).toBe(400)
    expect(await status(upsertEvent(target, { event: { title: 'Конец раньше', startsAt: `${inDays(3)}T19:00`, endsAt: `${inDays(3)}T18:00`, ...SOURCE } }, 'mcp'))).toBe(400)
    expect(await status(upsertEvent(target, { event: { title: 'Афиша', startsAt: `${inDays(3)}T19:00`, ...SOURCE, sourceUrl: 'https://www.afisha.ru/concert/1' } }, 'mcp'))).toBe(400)
    expect(await status(upsertEvent(target, { event: { title: 'http', startsAt: `${inDays(3)}T19:00`, ticketUrl: 'http://tickets.example/1', ...SOURCE } }, 'mcp'))).toBe(400)
    const liveRoute = await route('practical-events-route', 'draft')
    expect(await status(upsertEvent(liveRoute, { event: { title: 'Маршрут', startsAt: `${inDays(3)}T19:00`, ...SOURCE } }, 'mcp'))).toBe(400)
  })

  it('takes a VK post as official_social only from the venue\'s own VK', async () => {
    const own = await venue('practical-events-vk', 'draft', { socials: [{ network: 'vk', url: 'https://vk.com/cafe_own' }], vkCommunityId: 123 })
    const post = (url: string) => upsertEvent(own, { event: { title: 'Джаз', startsAt: `${inDays(4)}T19:00`, ...SOURCE, sourceUrl: url } }, 'mcp')
    const byName = await post('https://vk.com/cafe_own?w=wall-123_45')
    expect((await Facts.liveSlot('venue', own.id, `event:${byName.event!.id}`))?.sourceKind).toBe('official_social')
    const byId = await post('https://vk.com/wall-123_46')
    expect((await Facts.liveSlot('venue', own.id, `event:${byId.event!.id}`))?.sourceKind).toBe('official_social')
    expect(await status(post('https://vk.com/other_cafe'))).toBe(400)
    expect(await status(post('https://t.me/cafe_own'))).toBe(400)

    const bare = await venue('practical-events-no-socials', 'draft')
    expect(await status(upsertEvent(bare, { event: { title: 'Джаз', startsAt: `${inDays(4)}T19:00`, ...SOURCE, sourceUrl: 'https://vk.com/cafe_own' } }, 'mcp'))).toBe(400)

    const museum = await place('practical-events-place-vk')
    expect(await status(upsertEvent(museum, { event: { title: 'Лекция', startsAt: `${inDays(4)}T19:00`, ...SOURCE, sourceUrl: 'https://vk.com/museum' } }, 'mcp'))).toBe(400)
    const site = await upsertEvent(museum, { event: { title: 'Лекция', startsAt: `${inDays(4)}T19:00`, ...SOURCE, sourceUrl: 'https://museum.example/afisha/lecture' } }, 'mcp')
    expect((await Facts.liveSlot('place', museum.id, `event:${site.event!.id}`))?.sourceKind).toBe('official')
  })

  it('refuses the draft token on a live place or venue', async () => {
    const live = await place('practical-events-live', 'published')
    const liveVenue = await venue('practical-events-venue', 'closed')
    enterContentScope('draft')
    for (const target of [live, liveVenue]) {
      expect(await status(upsertEvent(target, { event: { title: 'Концерт', startsAt: `${inDays(3)}T19:00`, ...SOURCE } }, 'mcp'))).toBe(409)
      expect(await CalendarEvents.forSubject(target.type, target.id)).toHaveLength(0)
    }
  })

  it('never shows a past row, and the expiry pass retires it', async () => {
    const target = await place('practical-expire', 'published')
    const now = new Date()
    const past = await CalendarEvents.insert({ subjectType: 'place', subjectId: target.id, title: 'Вчера', startsAt: new Date(now.getTime() - 26 * 3_600_000).toISOString(), endsAt: null, allDay: false, ticketUrl: null, ...SOURCE })
    const future = await upsertEvent(target, { event: { title: 'Завтра', startsAt: `${inDays(2)}T12:00`, ...SOURCE } }, 'editor')
    await Facts.upsert({ kind: 'event', subjectType: 'place', subjectId: target.id, slot: `event:${past.id}`, value: { title: 'Вчера', start: past.startsAt, end: null, ticketUrl: null, allDay: false }, valueHash: 'x', sourceUrl: SOURCE.sourceUrl, sourceTitle: null, sourceKind: 'official', checkedAt: now.toISOString(), ttlDays: 7, confidence: 'stated', actor: 'editor' }, [])

    expect((await loadSubjectEvents('place', target.id, now)).lines.map((line) => line.title)).toEqual(['Завтра'])
    expect((await loadMemberEvents([target.id], now)).map((line) => line.subject?.href)).toEqual([`/${target.slug}`])

    await retirePastEvents(now)
    expect((await CalendarEvents.byId(past.id))?.expiredAt).toBeTruthy()
    expect((await CalendarEvents.byId(future.event!.id))?.expiredAt).toBeNull()
    expect(await Facts.liveSlot('place', target.id, `event:${past.id}`)).toBeNull()
  })
})

function extra(slot = 'audio', patch: Partial<AdmissionExtraInput> = {}): AdmissionExtraInput {
  return { slot, label: 'Фикстура: аудиогид', priceRub: 200, unit: 'device', ...SOURCE, ...patch }
}

describe('admission extra writes and migration', () => {
  it('migrates legacy rows without changing stored amounts, provenance or dates', async () => {
    const folder = resolveMigrationsFolder()
    const original = readFileSync(resolve(folder, '0044_admission_events.sql'), 'utf8').split('CREATE TABLE "calendar_events"')[0]!
      .replace('CREATE TABLE', 'CREATE TEMP TABLE')
      .replaceAll('admission_prices', 'legacy_admission_prices')
    const migration = readFileSync(resolve(folder, '0046_admission_extras.sql'), 'utf8').replaceAll('admission_prices', 'legacy_admission_prices')
    await useDatabase().transaction(async (tx) => {
      for (const statement of original.split('--> statement-breakpoint').filter((value) => value.trim())) {
        await tx.execute(sql.raw(statement))
      }
      await tx.execute(sql`insert into legacy_admission_prices (id,subject_type,subject_id,slot,audience,price_rub,source_url,source_title,checked_at) values ('legacy','place','fixture','adult','general',500,'https://museum.example/prices','Музей','2025-01-02')`)
      const before = (await tx.execute(sql`select * from legacy_admission_prices`)).rows[0]
      for (const statement of migration.split('--> statement-breakpoint').filter((value) => value.trim())) {
        await tx.execute(sql.raw(statement))
      }
      const after = (await tx.execute(sql`select * from legacy_admission_prices`)).rows[0]
      expect(after).toMatchObject({ ...before, kind: 'entry', unit: null })
      await tx.execute(sql`drop table legacy_admission_prices`)
    })
  })

  it('accepts 48 entries and 12 extras and preserves omitted lists including fact hashes', async () => {
    const target = await place('extras-capacity')
    const rows = Array.from({ length: 48 }, (_, index) => row(`r${index}`))
    const extras = Array.from({ length: 12 }, (_, index) => extra(`x${index}`))
    expect((await setAdmission(target, { rows, extras }, 'editor')).rows).toHaveLength(48)
    const before = await Facts.liveSlot('place', target.id, 'admission-extra:x0')
    await setAdmission(target, rows, 'editor')
    expect((await readAdmission(target)).extras).toHaveLength(12)
    expect(await Facts.liveSlot('place', target.id, 'admission-extra:x0')).toEqual(before)
    expect(await status(setAdmission(target, { rows: [...rows, row('overflow')] }, 'editor'))).toBe(400)
    expect(await status(setAdmission(target, { extras: [...extras, extra('overflow')] }, 'editor'))).toBe(400)
    await setAdmission(target, { rows: [] }, 'editor')
    expect((await readAdmission(target)).extras).toHaveLength(12)
    expect(await Facts.liveSlot('place', target.id, 'admission:r0')).toBeNull()
    await setAdmission(target, { extras: [] }, 'editor')
    expect((await readAdmission(target)).extras).toEqual([])
    expect(await Facts.liveSlot('place', target.id, 'admission-extra:x0')).toBeNull()
  })

  it('validates both lists before mutation and rejects duplicates and invalid service inputs', async () => {
    const target = await place('extras-invalid')
    await setAdmission(target, { rows: [row('entry')], extras: [extra()] }, 'editor')
    const before = await readAdmission(target)
    for (const input of [
      { rows: [], extras: [extra(), extra()] },
      { rows: [], extras: [extra('bad', { unit: 'hour' as 'device' })] },
      { extras: [extra('bad', { priceRub: 0 })] },
      { extras: [extra('bad', { label: ' ' })] },
      { extras: [extra('bad', { sourceUrl: 'https://yandex.ru/maps/org/1' })] },
      { extras: [extra('bad', { checkedAt: '2026-02-30' })] },
      { extras: [extra('bad', { checkedAt: inDays(2) })] },
    ]) {
      expect(await status(setAdmission(target, input, 'editor'))).toBe(400)
      expect(await readAdmission(target)).toEqual(before)
    }
  })

  it('keeps slot namespaces separate through fact updates and retirement', async () => {
    const target = await place('extras-fact-update', 'published')
    await setAdmission(target, { rows: [row('same')], extras: [extra('same')] }, 'editor')
    const entryFact = await Facts.liveSlot('place', target.id, 'admission:same')
    const extraFact = await Facts.liveSlot('place', target.id, 'admission-extra:same')
    expect(extraFact?.value).toMatchObject({ kind: 'extra', unit: 'device' })
    enterContentScope('editor')
    await updateFact({ id: extraFact!.id, value: { kind: 'extra', priceRub: 250, label: 'Фикстура: аудиогид', condition: 'Нужен входной билет', unit: 'person' }, sourceUrl: SOURCE.sourceUrl, sourceKind: 'official', confidence: 'stated' })
    expect((await readAdmission(target)).extras[0]).toMatchObject({ priceRub: 250, unit: 'person' })
    expect(await Facts.liveSlot('place', target.id, 'admission:same')).toEqual(entryFact)
    expect(await status(updateFact({ id: extraFact!.id, value: entryFact!.value, sourceUrl: SOURCE.sourceUrl, sourceKind: 'official', confidence: 'stated' }))).toBe(400)
    await setAdmission(target, { extras: [] }, 'editor')
    expect(await Facts.liveSlot('place', target.id, 'admission-extra:same')).toBeNull()
    expect(await Facts.liveSlot('place', target.id, 'admission:same')).toEqual(entryFact)
    const refs = await Facts.refsFor(extraFact!.id)
    expect(refs).toEqual([])
  })

  it('refuses live draft-token writes and rollout-disabled extra writes without changing data', async () => {
    const targets = [await place('extras-live', 'published'), await venue('extras-live-venue', 'closed'), await route('extras-live-route', 'published')]
    enterContentScope('draft')
    for (const target of targets) {
      expect(await status(setAdmission(target, { extras: [extra()] }, 'mcp'))).toBe(409)
      expect((await readAdmission(target)).extras).toEqual([])
    }
    enterContentScope('editor')
    const target = targets[0]!
    vi.stubEnv('FEATURE_ADMISSION_EXTRAS_WRITE', 'false')
    expect(await status(setAdmission(target, { rows: [row('entry')], extras: [extra()] }, 'editor'))).toBe(503)
    expect((await readAdmission(target)).rows).toEqual([])
    await setAdmission(target, [row('entry')], 'editor')
    expect((await readAdmission(target)).rows).toHaveLength(1)
  })

  it('rolls row/fact writes back after a downstream failure and retries cleanly', async () => {
    const target = await place('extras-rollback')
    await setAdmission(target, [row('entry')], 'editor')
    const before = await readAdmission(target)
    vi.spyOn(Facts, 'ensureSource').mockRejectedValueOnce(new Error('isolated source watcher failure'))
    await expect(setAdmission(target, { rows: [row('entry', { priceRub: 700 })], extras: [extra()] }, 'editor')).rejects.toThrow('source watcher failure')
    expect(await readAdmission(target)).toEqual(before)
    expect((await Facts.liveSlot('place', target.id, 'admission:entry'))?.value).toMatchObject({ priceRub: 400 })
    expect(await Facts.liveSlot('place', target.id, 'admission-extra:audio')).toBeNull()
    const retried = await setAdmission(target, { rows: [row('entry', { priceRub: 700 })], extras: [extra()] }, 'editor')
    expect(retried.extras).toHaveLength(1)
    expect((await Facts.liveSlot('place', target.id, 'admission:entry'))?.value).toMatchObject({ priceRub: 700 })
  })

  it('serializes concurrent replacements without losing the other list or desynchronizing facts', async () => {
    const target = await place('extras-concurrent')
    await Promise.all([
      setAdmission(target, { rows: [row('entry')] }, 'editor'),
      setAdmission(target, { extras: [extra()] }, 'editor'),
    ])
    const saved = await readAdmission(target)
    expect(saved.rows).toHaveLength(1)
    expect(saved.extras).toHaveLength(1)
    await Promise.all([setAdmission(target, [row('entry', { priceRub: 501 })], 'editor'), setAdmission(target, [row('entry', { priceRub: 502 })], 'editor')])
    const after = await readAdmission(target)
    expect((await Facts.liveSlot('place', target.id, 'admission:entry'))?.value).toMatchObject({ priceRub: after.rows[0]!.priceRub })
    expect(after.extras).toEqual(saved.extras)
  })

  it('preserves an owner-controlled row and queues conflicts; refuses its omission', async () => {
    const target = await place('extras-owner')
    await setAdmission(target, { extras: [extra()] }, 'editor')
    const fact = await Facts.liveSlot('place', target.id, 'admission-extra:audio')
    await Facts.upsert({ kind: 'admission', subjectType: 'place', subjectId: target.id, slot: fact!.slot,
      value: fact!.value, valueHash: fact!.valueHash, sourceUrl: null, sourceTitle: null, sourceKind: 'owner',
      checkedAt: fact!.checkedAt, ttlDays: 90, confidence: 'owner', actor: 'owner' }, [])
    const saved = await setAdmission(target, { extras: [extra('audio', { priceRub: 300 })] }, 'mcp')
    expect(saved.ownerConflicts).toHaveLength(1)
    expect(saved.extras[0]!.priceRub).toBe(200)
    expect((await Facts.liveSlot('place', target.id, fact!.slot))?.valueHash).toBe(fact!.valueHash)
    expect(await status(setAdmission(target, { extras: [] }, 'mcp'))).toBe(409)
    expect((await readAdmission(target)).extras).toHaveLength(1)
  })

  it('refreshes displayed admission dates on hash confirmation without changing values or revisions', async () => {
    const target = await place('extras-confirm')
    await setAdmission(target, { rows: [row('same', { checkedAt: inDays(-400) })], extras: [extra('same', { checkedAt: inDays(-400) })] }, 'editor')
    const fact = await Facts.liveSlot('place', target.id, 'admission-extra:same')
    const revisions = await Facts.revisions(fact!.id)
    expect((await loadAdmission('place', target.id)).extras).toEqual([])
    expect((await Facts.confirm(fact!.id, 'b'.repeat(64), new Date().toISOString())).ok).toBe(false)
    expect((await loadAdmission('place', target.id)).extras).toEqual([])
    expect((await Facts.confirm(fact!.id, fact!.valueHash, new Date().toISOString())).ok).toBe(true)
    expect((await loadAdmission('place', target.id)).extras).toHaveLength(1)
    expect((await loadAdmission('place', target.id)).rows).toEqual([])
    expect(await Facts.revisions(fact!.id)).toEqual(revisions)
    expect((await Facts.liveSlot('place', target.id, 'admission-extra:same'))?.valueHash).toBe(fact!.valueHash)
  })

  it('excludes extra rows from database admission scoring evidence', async () => {
    const target = await place('extras-score')
    await setAdmission(target, { extras: [extra()] }, 'editor')
    const alone = ((await Scoring.loadCatalog()).practical ?? []).find((item) => item.subjectId === target.id)
    expect(alone?.admissionRows ?? 0).toBe(0)
    await setAdmission(target, [row('entry')], 'editor')
    expect(((await Scoring.loadCatalog()).practical ?? []).find((item) => item.subjectId === target.id)).toMatchObject({ admissionRows: 1, freshAdmission: 1 })
  })
})
