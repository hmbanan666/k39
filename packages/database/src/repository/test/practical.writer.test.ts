// Lives in the database suite so it uses that Postgres.
// Typechecked from apps/web-app/tsconfig.writer-test.json, where Nuxt
// auto-imports exist. This package's tsc excludes the file.
import type { AdmissionRowInput } from '../../../../../apps/web-app/server/utils/practical/admission'
import type { VenueStatus } from '../../venues'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { enterContentScope } from '../../../../../apps/web-app/server/utils/access'
import { updateFact } from '../../../../../apps/web-app/server/utils/mcp/fact-write'
import { setAdmission } from '../../../../../apps/web-app/server/utils/practical/admission'
import { retirePastEvents, upsertEvent } from '../../../../../apps/web-app/server/utils/practical/events'
import { loadAdmission, loadMemberEvents, loadSubjectEvents } from '../../../../../apps/web-app/server/utils/practical/public'
import { practicalTarget } from '../../../../../apps/web-app/server/utils/practical/target'
import { useDatabase } from '../../database'
import { admissionPrices, calendarEvents, contentDrafts, facts, places, routes, venues, verificationQueue } from '../../tables'
import { Editor } from '../content'
import { Facts } from '../facts'
import { CalendarEvents } from '../practical'

const placeIds: string[] = []
const venueIds: string[] = []
const routeIds: string[] = []

afterEach(async () => {
  enterContentScope('editor')
  const database = useDatabase()
  for (const id of [...placeIds, ...venueIds, ...routeIds]) {
    await database.delete(verificationQueue).where(eq(verificationQueue.entityId, id))
    await database.delete(facts).where(eq(facts.subjectId, id))
    await database.delete(admissionPrices).where(eq(admissionPrices.subjectId, id))
    await database.delete(calendarEvents).where(eq(calendarEvents.subjectId, id))
    await database.delete(contentDrafts).where(eq(contentDrafts.entityId, id))
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
  it('validates audience rules, free at zero, the row cap, and the official source', async () => {
    const target = await place('practical-validate')
    expect(await status(setAdmission(target, Array.from({ length: 13 }, (_, index) => row(`r${index}`)), 'mcp'))).toBe(400)
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
