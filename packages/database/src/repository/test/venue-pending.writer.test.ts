import type { VenuePendingPayload } from '../../../../../apps/web-app/server/utils/venues/pending'
import type { VenueModule } from '../../../../../apps/web-app/shared/venue-modules'
import { and, eq, inArray } from 'drizzle-orm'
import { createError } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import pricesSet from '../../../../../apps/web-app/server/mcp/tools/venue-prices-set'
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
import { toPublicVenueModules } from '../../../../../apps/web-app/shared/venue-modules'
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
  it.each(['editor', 'draft'] as const)('warns about usable official prices without a prices module in %s scope', async (scope) => {
    const row = await venue()
    const before = await Venues.byId(row.id)
    const pricesBefore = await Prices.forVenue(row.id)
    enterContentScope(scope)
    const result = await writeVenuePrices(row.id, prices)
    expect(result).toMatchObject({
      pendingReview: scope === 'draft',
      warnings: [{ code: 'prices_hidden_missing_module', message: expect.stringContaining('Ориентиры цен') }],
    })
    expect((await Venues.byId(row.id))?.modules).toEqual(before?.modules)
    expect(await Prices.forVenue(row.id)).toEqual(pricesBefore)
  })

  const curated: VenueModule[] = [
    { type: 'text', variant: 'plain', text: 'Зал на первом этаже.' },
    { type: 'prices', title: 'Кофе из меню' },
    { type: 'tips', items: ['Вход со двора.'] },
  ]

  it.each(['editor', 'draft'] as const)('keeps a custom prices title and stored order without warning in %s scope', async (scope) => {
    const row = await venue()
    await Venues.update(row.id, { modules: curated })
    enterContentScope(scope)
    const result = await writeVenuePrices(row.id, [{ ...prices[0]!, priceRub: 270 }])
    expect(result.warnings).toEqual([])
    expect((await Venues.byId(row.id))?.modules).toEqual(curated)
  })

  it.each(['editor', 'draft'] as const)('does not warn for empty, stale, ineligible or owner rows in %s scope', async (scope) => {
    const row = await venue()
    enterContentScope(scope)
    for (const input of [
      [],
      [{ ...prices[0]!, checkedAt: '2000-01-01' }],
      [{ ...prices[0]!, sourceUrl: 'https://vk.com/wall-123_456' }],
      [{ ...prices[0]!, sourceKind: 'owner' as const, sourceUrl: null }],
    ]) {
      const result = await writeVenuePrices(row.id, input)
      expect(result.warnings, JSON.stringify(input)).toEqual([])
      expect((await Venues.byId(row.id))?.modules).toEqual([])
    }
  })

  it('keeps map-source refusal and pending application guards instead of treating maps as usable prices', async () => {
    const row = await venue()
    const mapPrices = [{ ...prices[0]!, sourceUrl: 'https://yandex.ru/maps/org/cafe/123' }]
    const before = await Prices.forVenue(row.id)
    await expect(writeVenuePrices(row.id, mapPrices)).rejects.toMatchObject({ statusCode: 400 })
    expect(await Prices.forVenue(row.id)).toEqual(before)
    enterContentScope('draft')
    const staged = await writeVenuePrices(row.id, mapPrices)
    expect(staged.warnings).toEqual([])
    const draft = await pending(row.id)
    enterContentScope('editor')
    await expect(applyPendingVenue(row.id)).rejects.toMatchObject({ statusCode: 400 })
    expect(await pending(row.id)).toEqual(draft)
    expect(await Prices.forVenue(row.id)).toEqual(before)
  })

  it('returns visibility feedback on a draft venue without publishing or staging it', async () => {
    const row = await venue('draft')
    enterContentScope('draft')
    const result = await writeVenuePrices(row.id, [{ ...prices[0]!, priceRub: 270 }])
    expect(result).toMatchObject({ pendingReview: false, warnings: [{ code: 'prices_hidden_missing_module' }] })
    expect((await Venues.byId(row.id))?.status).toBe('draft')
    expect(await Editor.contentDraft('venue', row.id)).toBeNull()
  })

  it.each([true, false])('evaluates pending modules, then admin application (add=%s)', async (add) => {
    const row = await venue()
    const liveModules = add ? [] : curated
    const pendingModules = add ? curated : []
    await Venues.update(row.id, { modules: liveModules })
    const pricesBefore = await Prices.forVenue(row.id)
    enterContentScope('draft')
    await updateVenue({ id: row.id, modules: pendingModules })
    const staged = await writeVenuePrices(row.id, [{ ...prices[0]!, priceRub: 270 }])
    expect(staged.warnings).toHaveLength(add ? 0 : 1)
    if (!add) {
      expect(staged.warnings[0]?.message).toContain('После применения черновика')
    }
    expect((await Venues.byId(row.id))?.modules).toEqual(liveModules)
    expect(await Prices.forVenue(row.id)).toEqual(pricesBefore)
    const draft = await pending(row.id)
    expect(draft.payload.fields).toMatchObject({ modules: pendingModules })
    await expect(applyPendingVenue(row.id)).rejects.toMatchObject({ statusCode: 403 })
    enterContentScope('editor')
    const applied = await decideVenueDraft(row.id, 'apply', draft.updatedAt)
    expect(applied).toMatchObject({ warnings: add ? [] : [{ code: 'prices_hidden_missing_module' }] })
    expect((await Venues.byId(row.id))?.modules).toEqual(pendingModules)
    expect((await Prices.forVenue(row.id))[0]?.priceRub).toBe(270)
  })

  it('uses the public fact overlay for unchanged saves rather than warning about a hidden gap', async () => {
    const row = await venue()
    await useDatabase().update(facts).set({ confidence: 'gap' }).where(and(eq(facts.subjectId, row.id), eq(facts.kind, 'price')))
    const result = await writeVenuePrices(row.id, prices)
    expect(result).toMatchObject({ unchanged: true, warnings: [] })
  })

  it('does not warn about an official proposal discarded by an owner conflict', async () => {
    const row = await venue()
    const userId = await owner(row.id)
    await saveOwnerVenue(userId, row.id, { prices: [{ ...prices[0]!, priceRub: 290 }] })
    enterContentScope('editor')
    const result = await writeVenuePrices(row.id, [{ ...prices[0]!, priceRub: 270 }])
    expect(result).toMatchObject({ warnings: [] })
    expect('ownerConflicts' in result && result.ownerConflicts.length).toBeGreaterThan(0)
    expect(await Prices.forVenue(row.id)).toMatchObject([{ priceRub: 290, sourceKind: 'owner' }])
    expect((await Venues.byId(row.id))?.modules).toEqual([])
  })

  it('exposes the shared writer warning through the actual MCP handler', async () => {
    const row = await venue()
    const result = await pricesSet.handler({ venueId: row.id, slug: undefined, prices }, {} as Parameters<typeof pricesSet.handler>[1])
    expect(result).toMatchObject({ warnings: [{ code: 'prices_hidden_missing_module' }] })
    expect(toPublicVenueModules((await Venues.byId(row.id))?.modules, (text) => text)).toBeNull()
    expect(await useDatabase().select().from(mcpAudits).where(eq(mcpAudits.entityId, row.id))).toHaveLength(1)
  })

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
