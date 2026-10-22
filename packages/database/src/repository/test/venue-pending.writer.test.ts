import type { VenuePendingPayload } from '../../../../../apps/web-app/server/utils/venues/pending'
import { eq, inArray } from 'drizzle-orm'
import { createError } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enterContentScope } from '../../../../../apps/web-app/server/utils/access'
import { decideVenueDraft, venueDraftNotice } from '../../../../../apps/web-app/server/utils/admin/venue-draft'
import { saveOwnerVenue } from '../../../../../apps/web-app/server/utils/cabinet/flow'
import { resetCabinetSlots } from '../../../../../apps/web-app/server/utils/cabinet/rate'
import { setVenuePrices } from '../../../../../apps/web-app/server/utils/facts/sync'
import { adminNoticesView, decideVenueNoticeDraft } from '../../../../../apps/web-app/server/utils/notices/admin'
import { setNotices } from '../../../../../apps/web-app/server/utils/notices/write'
import { practicalTarget } from '../../../../../apps/web-app/server/utils/practical/target'
import { loadSchedule, saveSchedule } from '../../../../../apps/web-app/server/utils/schedule'
import { previewContentScore } from '../../../../../apps/web-app/server/utils/scoring/run'
import { projectMenuPrices } from '../../../../../apps/web-app/server/utils/venues/menu-prices'
import { applyPendingVenue, venuePendingReview, writeVenueOpeningSchedule, writeVenuePrices } from '../../../../../apps/web-app/server/utils/venues/pending'
import { updateVenue } from '../../../../../apps/web-app/server/utils/venues/write'
import { scheduleRulesSchema } from '../../../../../apps/web-app/shared/schedule'
import { useDatabase } from '../../database'
import { contentDrafts, facts, mcpAudits, priceItems, revisions, schedules, users, venueAudits, venueMembers, venues, verificationQueue } from '../../tables'
import { Editor } from '../content'
import { Facts } from '../facts'
import { Prices } from '../prices'
import { Venues } from '../venues'

vi.stubGlobal('createError', createError)
const ids: string[] = []
const userIds: string[] = []
const SOURCE = 'https://cafe.example/menu'
const DESCRIPTION = 'Кафе на городской улице занимает первый этаж двухэтажного дома. В зале стоят столы на двоих и большой стол у окна. В меню есть завтраки, супы и горячие блюда, а у стойки можно заказать кофе с собой. Вход находится со стороны улицы, рядом с автобусной остановкой. Перед поездкой проверьте действующее расписание и условия бронирования на официальном сайте заведения.'
const rules = scheduleRulesSchema.parse({ mode: 'hours', seasons: [{ week: [{ days: [0, 1, 2, 3, 4, 5, 6], opens: '10:00', closes: '18:00' }] }] })
const nextRules = scheduleRulesSchema.parse({ mode: 'appointment', note: 'Условия бронирования на сайте' })
const prices = [{ item: 'pending-coffee', variant: '250 мл', priceRub: 250, checkedAt: '2026-10-21', sourceKind: 'official' as const, sourceTitle: 'Меню', sourceUrl: SOURCE }]

afterEach(async () => {
  enterContentScope('editor')
  resetCabinetSlots()
  const db = useDatabase()
  for (const id of ids) {
    await db.delete(contentDrafts).where(eq(contentDrafts.entityId, id))
    await db.delete(verificationQueue).where(eq(verificationQueue.entityId, id))
    await db.delete(facts).where(eq(facts.subjectId, id))
    await db.delete(schedules).where(eq(schedules.entityId, id))
    await db.delete(revisions).where(eq(revisions.entityId, id))
    await db.delete(mcpAudits).where(eq(mcpAudits.entityId, id))
    await db.delete(venueAudits).where(eq(venueAudits.venueId, id))
  }
  if (ids.length) {
    await db.delete(venues).where(inArray(venues.id, ids))
  }
  if (userIds.length) {
    await db.delete(users).where(inArray(users.id, userIds))
  }
  ids.length = 0
  userIds.length = 0
})

async function venue(status: 'published' | 'closed' | 'archived' | 'draft' = 'published') {
  enterContentScope('editor')
  const row = await Venues.create({ name: 'Кафе для проверки', kind: 'cafe', description: DESCRIPTION, status, phone: '+7 4012 12-34-56', website: 'https://cafe.example' })
  ids.push(row.id)
  await Prices.upsertItem({ slug: 'pending-coffee', title: 'Кофе', category: 'coffee', defaultVariant: '250 мл' })
  await saveSchedule('venue', row.id, { rules, sourceUrl: SOURCE, verifiedAt: '2026-10-20' }, { actor: 'editor' })
  await setVenuePrices(row.id, prices, 'editor', status)
  return row
}

async function owner(id: string) {
  const [user] = await useDatabase().insert(users).values({ name: 'Владелец', email: `${id}@owner.example` }).returning()
  userIds.push(user!.id)
  await useDatabase().insert(venueMembers).values({ venueId: id, userId: user!.id, role: 'owner' })
  return user!.id
}

async function pending(id: string) {
  return (await Editor.contentDraft('venue', id))!
}

describe('pending venue drafts (ADR 0047)', () => {
  it('keeps an allowed menu document comparable after the price fact is written', async () => {
    const row = await venue()
    await setVenuePrices(row.id, [{ ...prices[0]!, sourceUrl: 'https://drive.google.com/file/d/menu/view' }], 'editor', row.status)
    const stored = (await Prices.forVenue(row.id)).map((price) => ({ ...price, venueId: row.id }))
    const shown = await projectMenuPrices(stored)
    expect(shown).toHaveLength(1)
    expect(shown[0]?.comparable).toBe(true)
  })

  it('merges fields, schedule, prices and notices without changing any live reader', async () => {
    const row = await venue()
    const before = await Venues.byId(row.id)
    const schedule = await loadSchedule('venue', row.id)
    const livePrices = await Prices.forVenue(row.id)
    enterContentScope('draft')
    const first = await updateVenue({ id: row.id, description: `${DESCRIPTION} Кофе готовят у стойки.` })
    expect(first.pendingReview).toBe(true)
    const stamp = (await pending(row.id)).payload.fieldStagedAt
    await writeVenueOpeningSchedule(row.id, { rules: nextRules, sourceUrl: SOURCE, verifiedAt: '2026-10-21' })
    await writeVenuePrices(row.id, [{ ...prices[0]!, priceRub: 270 }])
    await setNotices({ subjectType: 'venue', id: row.id, notices: [{ kind: 'renovation', from: '2026-10-22', to: '2026-11-02', text: 'Ремонт входа', sourceUrl: 'https://cafe.example/news', sourceTitle: 'Объявление', checkedAt: '2026-10-22' }] }, 'mcp')
    await updateVenue({ id: row.id, phone: '+7 4012 99-88-77' })
    const draft = await pending(row.id)
    expect((draft.payload.fieldStagedAt as Record<string, string>).description).toBe((stamp as Record<string, string>).description)
    expect(draft.payload).toMatchObject({ schedule: { rules: nextRules }, prices: [{ priceRub: 270 }], notices: [{ text: 'Ремонт входа' }] })
    expect(await Venues.byId(row.id)).toEqual(before)
    expect(await loadSchedule('venue', row.id)).toEqual(schedule)
    expect(await Prices.forVenue(row.id)).toEqual(livePrices)
    expect((await venuePendingReview(row))?.changedFields).toEqual(expect.arrayContaining(['description', 'phone', 'schedule', 'prices', 'notices']))
    const notice = await venueDraftNotice(row.id)
    expect(notice?.changes.map((item) => item.field)).toEqual(expect.arrayContaining(['description', 'phone', 'schedule', 'prices', 'notices']))
    expect((await previewContentScore(`/zavedeniya/${row.slug}`))?.source).toBe('pending')
  })

  it.each(['published', 'closed'] as const)('applies all ledgers atomically and keeps %s status and check dates', async (status) => {
    const row = await venue(status)
    enterContentScope('draft')
    await updateVenue({ id: row.id, description: `${DESCRIPTION} У входа есть стойка.` })
    await writeVenueOpeningSchedule(row.id, { rules: nextRules, sourceUrl: SOURCE, verifiedAt: '2026-10-19' })
    await writeVenuePrices(row.id, [{ ...prices[0]!, priceRub: 280, checkedAt: '2026-10-18' }])
    enterContentScope('editor')
    const result = await applyPendingVenue(row.id)
    expect(result.pendingReview).toBe(false)
    expect((await Venues.byId(row.id))?.status).toBe(status)
    expect(await Editor.contentDraft('venue', row.id)).toBeNull()
    expect(await loadSchedule('venue', row.id)).toMatchObject({ rules: nextRules, verifiedAt: '2026-10-19' })
    expect(await Prices.forVenue(row.id)).toMatchObject([{ priceRub: 280, checkedAt: '2026-10-18' }])
    const hours = await Facts.liveSlot('venue', row.id, 'hours')
    expect(await Facts.latestActor(hours!.id)).toBe('editor')
  })

  it('rejects a whole write containing editorial fields or legacy hours', async () => {
    const row = await venue()
    enterContentScope('draft')
    for (const [key, value] of Object.entries({ status: 'closed', slug: 'new-slug', seoTitle: 'Заголовок', seoDescription: 'Текст', noindex: true, socials: [], vkCommunityId: 123, contactEmail: 'owner@example.org', osmId: 'node/123' })) {
      await expect(updateVenue({ id: row.id, [key]: value, description: `${DESCRIPTION} Текст.` })).rejects.toMatchObject({ statusCode: 409 })
    }
    await expect(updateVenue({ id: row.id, status: 'published' })).rejects.toMatchObject({ statusCode: 403 })
    await expect(updateVenue({ id: row.id, hours: { note: 'Текст' }, phone: '123' })).rejects.toMatchObject({ statusCode: 400 })
    expect(await Editor.contentDraft('venue', row.id)).toBeNull()
    expect((await Venues.byId(row.id))?.description).toBe(DESCRIPTION)
  })

  it('refuses archived writes through every staged entry point', async () => {
    const row = await venue('archived')
    enterContentScope('draft')
    await expect(updateVenue({ id: row.id, description: 'Текст' })).rejects.toMatchObject({ statusCode: 409 })
    await expect(writeVenueOpeningSchedule(row.id, null)).rejects.toMatchObject({ statusCode: 409 })
    await expect(writeVenuePrices(row.id, [])).rejects.toMatchObject({ statusCode: 409 })
    expect(await Editor.contentDraft('venue', row.id)).toBeNull()
  })

  it('stages explicit clears while omission keeps live schedule and prices', async () => {
    const row = await venue()
    enterContentScope('draft')
    await updateVenue({ id: row.id, description: `${DESCRIPTION} Есть зал.` })
    enterContentScope('editor')
    await applyPendingVenue(row.id)
    expect(await loadSchedule('venue', row.id)).not.toBeNull()
    expect(await Prices.forVenue(row.id)).toHaveLength(1)
    enterContentScope('draft')
    await writeVenueOpeningSchedule(row.id, null)
    await writeVenuePrices(row.id, [])
    enterContentScope('editor')
    await applyPendingVenue(row.id)
    expect(await loadSchedule('venue', row.id)).toBeNull()
    expect(await Facts.liveSlot('venue', row.id, 'hours')).toBeNull()
    expect(await Prices.forVenue(row.id)).toEqual([])
  })

  it('keeps newer owner fields and their staging times while applying clear keys', async () => {
    const row = await venue()
    const userId = await owner(row.id)
    enterContentScope('draft')
    await updateVenue({ id: row.id, description: `${DESCRIPTION} Текст агента.` })
    const first = await pending(row.id)
    await saveOwnerVenue(userId, row.id, { description: `${DESCRIPTION} Правка владельца.` })
    expect((await pending(row.id)).id).toBe(first.id)
    await updateVenue({ id: row.id, phone: '+7 4012 99-88-77' })
    expect(((await pending(row.id)).payload as VenuePendingPayload).fieldStagedAt?.description).toBe((first.payload as VenuePendingPayload).fieldStagedAt?.description)
    enterContentScope('editor')
    const applied = await applyPendingVenue(row.id)
    expect(applied.ownerConflicts).toEqual(['description'])
    expect((await Venues.byId(row.id))?.phone).toBe('+7 4012 99-88-77')
    expect((await Venues.byId(row.id))?.description).toContain('Правка владельца')
    expect((await pending(row.id)).payload).toMatchObject({ fields: { description: `${DESCRIPTION} Текст агента.` } })
    await expect(applyPendingVenue(row.id)).rejects.toMatchObject({ statusCode: 409, data: { ownerConflicts: ['description'] } })
    enterContentScope('draft')
    await updateVenue({ id: row.id, description: `${DESCRIPTION} Новая редакция.` })
    enterContentScope('editor')
    expect((await applyPendingVenue(row.id)).pendingReview).toBe(false)
  })

  it('preserves owner schedule and prices as whole blocked keys', async () => {
    const row = await venue()
    const userId = await owner(row.id)
    enterContentScope('draft')
    await writeVenueOpeningSchedule(row.id, { rules: nextRules, sourceUrl: SOURCE, verifiedAt: '2026-10-21' })
    await writeVenuePrices(row.id, [{ ...prices[0]!, priceRub: 270 }])
    await saveOwnerVenue(userId, row.id, { hours: { note: 'Часы кухни уточняйте на месте' }, prices: [{ ...prices[0]!, priceRub: 290 }] })
    const schedule = await loadSchedule('venue', row.id)
    const livePrices = await Prices.forVenue(row.id)
    enterContentScope('editor')
    await expect(applyPendingVenue(row.id)).rejects.toMatchObject({ statusCode: 409, data: { ownerConflicts: ['schedule', 'prices'] } })
    expect(await loadSchedule('venue', row.id)).toEqual(schedule)
    expect(await Prices.forVenue(row.id)).toEqual(livePrices)
  })

  it('rolls back columns, facts and draft deletion when the later price write fails', async () => {
    const row = await venue()
    await Prices.upsertItem({ slug: 'pending-removed', title: 'Чай', category: 'tea' })
    enterContentScope('draft')
    await updateVenue({ id: row.id, phone: '+7 4012 99-88-77' })
    await writeVenuePrices(row.id, [{ ...prices[0]!, item: 'pending-removed' }])
    await useDatabase().delete(priceItems).where(eq(priceItems.slug, 'pending-removed'))
    const draft = await pending(row.id)
    enterContentScope('editor')
    await expect(applyPendingVenue(row.id)).rejects.toThrow('Нет такой позиции')
    expect((await Venues.byId(row.id))?.phone).toBe(row.phone)
    expect(await Facts.liveSlot('venue', row.id, 'phone')).toBeNull()
    expect(await pending(row.id)).toEqual(draft)
  })

  it('rejects a stale apply stamp and preserves the later draft', async () => {
    const row = await venue()
    enterContentScope('draft')
    await updateVenue({ id: row.id, description: `${DESCRIPTION} Первый текст.` })
    const old = await pending(row.id)
    await updateVenue({ id: row.id, description: `${DESCRIPTION} Второй текст.` })
    const newer = await pending(row.id)
    enterContentScope('editor')
    await expect(applyPendingVenue(row.id, old)).rejects.toMatchObject({ statusCode: 409 })
    await expect(decideVenueDraft(row.id, 'apply', old.updatedAt)).rejects.toMatchObject({ statusCode: 409 })
    await expect(decideVenueDraft(row.id, 'discard', old.updatedAt)).rejects.toMatchObject({ statusCode: 409 })
    expect(await pending(row.id)).toEqual(newer)
    expect((await Venues.byId(row.id))?.description).toBe(DESCRIPTION)
  })

  it('keeps a stop-list warning as a draft and rejects apply before changing ledgers', async () => {
    const row = await venue()
    const before = await loadSchedule('venue', row.id)
    enterContentScope('draft')
    const staged = await updateVenue({ id: row.id, description: `${DESCRIPTION} Это идеальное место.` })
    expect(staged.writingWarnings.length).toBeGreaterThan(0)
    await writeVenueOpeningSchedule(row.id, null)
    await writeVenuePrices(row.id, [])
    const draft = await pending(row.id)
    enterContentScope('editor')
    await expect(applyPendingVenue(row.id)).rejects.toMatchObject({ statusCode: 400 })
    expect((await Venues.byId(row.id))?.description).toBe(DESCRIPTION)
    expect(await loadSchedule('venue', row.id)).toEqual(before)
    expect(await Prices.forVenue(row.id)).toHaveLength(1)
    expect(await pending(row.id)).toEqual(draft)
  })

  it('does not apply unseen venue fields from the local notices-only control', async () => {
    const row = await venue()
    enterContentScope('draft')
    await updateVenue({ id: row.id, description: `${DESCRIPTION} Новый текст.` })
    const draft = await pending(row.id)
    const target = await practicalTarget('venue', row.id)
    expect((await adminNoticesView(target)).pending).toBeNull()
    enterContentScope('editor')
    await expect(decideVenueNoticeDraft(target, 'apply', draft.updatedAt)).rejects.toMatchObject({ statusCode: 409 })
    expect((await Venues.byId(row.id))?.description).toBe(DESCRIPTION)
  })

  it('blocks admin saves until discard and keeps a draft through editor no-ops', async () => {
    const row = await venue()
    const userId = await owner(row.id)
    enterContentScope('draft')
    await updateVenue({ id: row.id, phone: '+7 4012 99-88-77' })
    const draft = await pending(row.id)
    enterContentScope('editor')
    await updateVenue({ id: row.id, description: DESCRIPTION })
    await writeVenueOpeningSchedule(row.id, await loadSchedule('venue', row.id))
    await writeVenuePrices(row.id, prices)
    expect(await pending(row.id)).toEqual(draft)
    await expect(updateVenue({ id: row.id, description: DESCRIPTION }, userId)).rejects.toMatchObject({ statusCode: 409 })
    await updateVenue({ id: row.id, description: `${DESCRIPTION} Правка редактора.`, pendingDraft: 'discard' }, userId)
    expect(await Editor.contentDraft('venue', row.id)).toBeNull()
  })

  it('keeps simultaneous staged keys rather than losing one payload', async () => {
    const row = await venue()
    enterContentScope('draft')
    await Promise.all([
      updateVenue({ id: row.id, description: `${DESCRIPTION} Новый текст.` }),
      writeVenueOpeningSchedule(row.id, { rules: nextRules, sourceUrl: SOURCE, verifiedAt: '2026-10-21' }),
      writeVenuePrices(row.id, [{ ...prices[0]!, priceRub: 270 }]),
    ])
    expect((await pending(row.id)).payload).toMatchObject({ fields: { description: `${DESCRIPTION} Новый текст.` }, schedule: { rules: nextRules }, prices: [{ priceRub: 270 }] })
  })
})
