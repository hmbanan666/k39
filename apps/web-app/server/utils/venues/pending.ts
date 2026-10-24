import type { ContentTx, VenueWrite } from '@k39/database'
import type { ScheduleRecord } from '../../../shared/schedule'
import type { VenuePriceWarning } from './price-feedback'
import { db } from '@k39/database'
import { priceFreshCutoff } from '@k39/types/freshness'
import { createError } from 'h3'
import { z } from 'zod'
import { resolveMenuPrice } from '../../../shared/price-compare'
import { venueModulesSchema } from '../../../shared/venue-modules'
import { contentScope } from '../access'
import { contentGate, savePendingDraftContent, syncSavedPage, updateVenueContent } from '../content/save'
import { retireFactSlot } from '../facts/commit'
import { setVenuePrices, syncCoordinates, syncVenueContact } from '../facts/sync'
import { parseFactsCheckedAt } from '../mcp/facts'
import { rejectBannedSites } from '../mcp/writing-guard'
import { onlyNoticesStaged, stagedForApply, toNoticeWrite } from '../notices/write'
import { practicalTarget } from '../practical/target'
import { loadSchedule, saveSchedule } from '../schedule'
import { normalizeDishModules } from './dishes'
import { projectMenuPrices } from './menu-prices'
import { recomputeTownPriceBands } from './price-band'
import { venuePriceWarnings } from './price-feedback'
import { venuePricesWriteSchema } from './prices'
import { venueFields } from './schema'

const stagedFieldsSchema = z.object(venueFields).omit({
  slug: true, status: true, hours: true, seoTitle: true, seoDescription: true,
  noindex: true, socials: true, vkCommunityId: true, osmId: true, contactEmail: true,
}).strict()
type StagedFields = z.infer<typeof stagedFieldsSchema>

export interface VenuePendingPayload extends Record<string, unknown> {
  fields?: StagedFields
  fieldStagedAt?: Record<string, string>
  schedule?: ScheduleRecord | null
  scheduleStagedAt?: string
  prices?: z.infer<typeof venuePricesWriteSchema>
  pricesStagedAt?: string
}

type Venue = NonNullable<Awaited<ReturnType<typeof db.venues.byId>>>
type Draft = NonNullable<Awaited<ReturnType<typeof db.editor.contentDraft>>>

function liveVenue(venue: Venue) {
  if (venue.status !== 'published' && venue.status !== 'closed') {
    throw createError({ statusCode: 409, statusMessage: 'Draft token cannot edit this venue. The live page was not changed.' })
  }
}

/** A staged region slug is resolved again on apply, so a removed region fails closed. */
export async function pendingVenueWrite(fields: StagedFields, tx?: ContentTx): Promise<VenueWrite> {
  const { regionSlug, ...rest } = stagedFieldsSchema.parse(fields)
  let regionId: string | null | undefined
  if (regionSlug !== undefined) {
    const region = regionSlug ? await db.venues.regionBySlug(regionSlug, tx) : null
    if (regionSlug && !region) {
      throw createError({ statusCode: 400, statusMessage: 'Территория каталога не найдена' })
    }
    regionId = region?.id ?? null
  }
  return { ...rest, ...(regionSlug === undefined ? {} : { regionId }) }
}

async function stage(id: string, prepare: (venue: Venue, tx: ContentTx, base: VenuePendingPayload) => Promise<Partial<VenuePendingPayload>>) {
  return db.venues.withLocked(id, async (tx, venue) => {
    liveVenue(venue)
    const previous = await db.editor.contentDraft('venue', id, tx)
    const base = (previous?.payload ?? {}) as VenuePendingPayload
    const patch = await prepare(venue, tx, base)
    const now = new Date().toISOString()
    const fields = { ...base.fields, ...patch.fields }
    const payload: VenuePendingPayload = {
      ...base,
      ...patch,
      ...(patch.fields
        ? {
            fields,
            fieldStagedAt: { ...base.fieldStagedAt, ...Object.fromEntries(Object.keys(patch.fields).map((key) => [key, now])) },
          }
        : {}),
      ...(Object.hasOwn(patch, 'schedule') ? { scheduleStagedAt: now } : {}),
      ...(Object.hasOwn(patch, 'prices') ? { pricesStagedAt: now } : {}),
    }
    const saved = await savePendingDraftContent({ entityType: 'venue', entityId: id, publicationStatus: 'review', payload }, contentGate('venue', { ...venue, ...fields }, false), tx)
    return {
      id, slug: venue.slug, status: venue.status, pendingReview: true as const,
      changedFields: await venueChangedFields(venue, payload, tx),
      writingWarnings: saved.writingWarnings,
      ...(fields.description === undefined ? {} : { descriptionLength: fields.description.length }),
    }
  })
}

export async function stageVenueFields(id: string, input: Record<string, unknown>) {
  return stage(id, async (venue) => {
    if (input.status === 'published') {
      throw createError({ statusCode: 403, statusMessage: 'Draft token cannot publish' })
    }
    const forbidden = ['status', 'seoTitle', 'seoDescription', 'noindex', 'socials', 'vkCommunityId', 'osmId', 'contactEmail', 'regionId']
    if (forbidden.some((key) => input[key] !== undefined) || (input.slug !== undefined && input.slug !== venue.slug)) {
      throw createError({ statusCode: 409, statusMessage: 'Draft token cannot edit editorial venue fields. The live page was not changed.' })
    }
    if (input.hours !== undefined) {
      throw createError({ statusCode: 400, statusMessage: 'Часы меняются через schedule_set' })
    }
    const { id: _id, slug: _slug, ...sent } = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
    const parsed = stagedFieldsSchema.parse(sent)
    if (parsed.lastVerifiedAt !== undefined) {
      parsed.lastVerifiedAt = parseFactsCheckedAt(parsed.lastVerifiedAt)
    }
    if (parsed.modules) {
      parsed.modules = await normalizeDishModules(id, venueModulesSchema.parse(parsed.modules), 'editorial')
    }
    const write = await pendingVenueWrite(parsed)
    const clean = await db.venues.prepareUpdate(venue, write, false)
    const fields = Object.fromEntries(Object.keys(parsed).map((key) => [key, key === 'regionSlug' ? parsed.regionSlug : clean[key as keyof typeof clean]])) as StagedFields
    return { fields }
  })
}

export function stageVenueSchedule(id: string, schedule: ScheduleRecord | null) {
  rejectBannedSites(schedule?.sourceUrl)
  return stage(id, async () => ({ schedule }))
}

export async function stageVenuePrices(id: string, input: unknown) {
  let warnings: VenuePriceWarning[] = []
  const result = await stage(id, async (venue, tx, base) => {
    const parsed = venuePricesWriteSchema.parse(input)
    const prices = (await db.prices.prepareInput(parsed, tx)).map(({ itemId: _itemId, ...row }) => row)
    const effective = { ...venue, ...base.fields }
    const catalog = new Map((await db.prices.items(tx)).map((item) => [item.slug, item]))
    const cutoff = priceFreshCutoff()
    const shown = prices.flatMap((row) => {
      const item = catalog.get(row.item)!
      // Applying this proposal creates new facts; current live facts are not its overlay.
      const resolved = resolveMenuPrice({ ...row, venueId: id, title: item.title, category: item.category, image: item.image }, null, cutoff, effective)
      return resolved?.comparable ? [resolved.row] : []
    })
    warnings = venuePriceWarnings(effective, shown, true)
    return { prices }
  })
  return { ...result, warnings }
}

/** The same fresh columns and fact overlay used by the public venue reader. */
async function storedPriceWarnings(venue: Venue) {
  const fresh = await db.prices.freshForVenue(venue.id)
  const projected = await projectMenuPrices(fresh.map((row) => ({ ...row, venueId: venue.id })))
  return venuePriceWarnings(venue, projected.filter((row) => row.comparable).map((row) => row.row))
}

/** The opening schedule tool; owner and admin weekly-table writers stay separate. */
export async function writeVenueOpeningSchedule(id: string, schedule: ScheduleRecord | null) {
  if (contentScope() === 'draft') {
    const venue = await db.venues.byId(id)
    if (venue?.status === 'published' || venue?.status === 'closed') {
      return stageVenueSchedule(id, schedule)
    }
  }
  return db.venues.withLocked(id, async (tx, venue) => {
    if (contentScope() === 'draft' && venue.status !== 'draft') {
      throw createError({ statusCode: 409, statusMessage: 'Draft token cannot edit this schedule. The live page was not changed.' })
    }
    const before = await loadSchedule('venue', id, tx)
    if (equal(before, schedule)) {
      return { id, slug: venue.slug, unchanged: true, pendingReview: false }
    }
    const pending = await db.editor.contentDraft('venue', id, tx)
    if (schedule) {
      const saved = await saveSchedule('venue', id, schedule, { actor: 'mcp', pageStatus: venue.status }, tx)
      if (saved.conflict) {
        return { id, slug: venue.slug, conflict: true, queueId: saved.queueId }
      }
    } else {
      await db.schedules.remove('venue', id, tx)
      await retireFactSlot('venue', id, 'hours', tx)
    }
    const draftDropped = contentScope() === 'editor' && pending
      ? await db.editor.deleteContentDraftIfUnchanged(pending.id, pending.updatedAt, tx)
      : false
    return { id, slug: venue.slug, pendingReview: false, draftDropped, removed: schedule === null }
  })
}

export async function writeVenuePrices(id: string, input: unknown) {
  const venue = await db.venues.byId(id)
  if (!venue) {
    throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
  }
  if (contentScope() === 'draft' && (venue.status === 'published' || venue.status === 'closed')) {
    return stageVenuePrices(id, input)
  }
  const result = await db.venues.withLocked(id, async (tx, current) => {
    if (contentScope() === 'draft' && current.status !== 'draft') {
      throw createError({ statusCode: 409, statusMessage: 'Draft token cannot edit prices on this venue. The live page was not changed.' })
    }
    const prices = (await db.prices.prepareInput(venuePricesWriteSchema.parse(input), tx)).map(({ itemId: _itemId, ...row }) => row)
    const changed = (await venueChangedFields(current, { prices }, tx)).includes('prices')
    if (!changed) {
      return { venueId: id, prices: await db.prices.forVenue(id, tx), unchanged: true, pendingReview: false, ownerConflicts: [] as string[], regionId: current.regionId, venue: current }
    }
    const pending = await db.editor.contentDraft('venue', id, tx)
    const saved = await setVenuePrices(id, prices, 'mcp', current.status, tx)
    const draftDropped = contentScope() === 'editor' && pending && saved.conflicts.length === 0
      ? await db.editor.deleteContentDraftIfUnchanged(pending.id, pending.updatedAt, tx)
      : false
    return { venueId: id, prices: saved.prices, pendingReview: false, ownerConflicts: saved.conflicts, draftDropped, regionId: current.regionId, venue: current }
  })
  if (!('unchanged' in result)) {
    await recomputeTownPriceBands(result.regionId)
  }
  const { venue: savedVenue, ...response } = result
  return { ...response, warnings: await storedPriceWarnings(savedVenue) }
}

function equal(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

export async function venueChangedFields(venue: Venue, payload: VenuePendingPayload, tx?: ContentTx) {
  const write = await pendingVenueWrite(payload.fields ?? {}, tx)
  const fields = Object.keys(write).filter((key) => !equal(venue[key as keyof Venue], write[key as keyof VenueWrite]))
  if (Object.hasOwn(payload, 'schedule') && !equal(await loadSchedule('venue', venue.id, tx), payload.schedule)) {
    fields.push('schedule')
  }
  if (payload.prices) {
    const current = await db.prices.forVenue(venue.id, tx)
    const live = current.map(({ item, variant, priceRub, checkedAt, sourceKind, sourceTitle, sourceUrl }) => ({ item, variant, priceRub, checkedAt, sourceKind, sourceTitle, sourceUrl }))
    const next = (await db.prices.prepareInput(payload.prices, tx)).map(({ itemId: _itemId, ...row }) => row)
    const order = (a: { item: string, variant: string }, b: { item: string, variant: string }) => `${a.item}:${a.variant}`.localeCompare(`${b.item}:${b.variant}`)
    if (!equal(live.sort(order), next.sort(order))) {
      fields.push('prices')
    }
  }
  if (Object.hasOwn(payload, 'notices')) {
    fields.push('notices')
  }
  return fields.map((key) => key === 'regionId' ? 'regionSlug' : key)
}

export async function venuePendingReview(venue: Venue) {
  const pending = await db.editor.contentDraft('venue', venue.id)
  return pending ? { ...pending, changedFields: await venueChangedFields(venue, pending.payload), pendingPublicationStatus: 'review' as const } : null
}

/** Check the stamp before touching columns, schedules, prices or facts. */
export async function applyPendingVenue(id: string, expected?: Pick<Draft, 'id' | 'updatedAt'>) {
  if (contentScope() !== 'editor') {
    throw createError({ statusCode: 403, statusMessage: 'Draft token cannot publish' })
  }
  const checked = expected ?? await db.editor.contentDraft('venue', id)
  if (!checked) {
    throw createError({ statusCode: 409, statusMessage: 'Черновика нет' })
  }
  const result = await db.venues.withLocked(id, async (tx, venue) => {
    liveVenue(venue)
    const draft = await db.editor.contentDraft('venue', id, tx)
    if (!draft || draft.id !== checked.id || draft.updatedAt !== checked.updatedAt) {
      throw createError({ statusCode: 409, statusMessage: 'Черновик изменился. Обновите страницу.' })
    }
    const payload = draft.payload as VenuePendingPayload
    if (onlyNoticesStaged(payload)) {
      const notices = await stagedForApply(await practicalTarget('venue', id), payload)
      if (notices) {
        await db.notices.replace('venue', id, notices.map(toNoticeWrite), tx)
      }
      await db.editor.deleteContentDraftIfUnchanged(draft.id, draft.updatedAt, tx)
      return { id, slug: venue.slug, status: venue.status, pendingReview: false, ownerConflicts: [] as string[], writingWarnings: [] as string[], pricesChanged: false, regionId: venue.regionId, previousRegionId: venue.regionId }
    }
    const owners = await db.venues.ownerDraftChanges(id, tx)
    const blocked = (key: string, at: string | undefined) => Date.parse(owners.get(key) ?? '1970-01-01') > Date.parse(at ?? draft.createdAt)
    const fields = { ...payload.fields }
    const remaining: VenuePendingPayload = { ...payload, fields: {}, fieldStagedAt: {} }
    const ownerConflicts: string[] = []
    for (const key of Object.keys(fields) as Array<keyof StagedFields>) {
      if (blocked(key, payload.fieldStagedAt?.[key])) {
        Object.assign(remaining.fields!, { [key]: fields[key] })
        remaining.fieldStagedAt![key] = payload.fieldStagedAt?.[key] ?? draft.createdAt
        delete fields[key]
        ownerConflicts.push(key)
      }
    }
    for (const key of ['schedule', 'prices'] as const) {
      if (Object.hasOwn(payload, key) && blocked(key, payload[`${key}StagedAt`])) {
        ownerConflicts.push(key)
      } else {
        delete remaining[key]
        delete remaining[`${key}StagedAt`]
      }
    }
    const hasSchedule = Object.hasOwn(payload, 'schedule') && !ownerConflicts.includes('schedule')
    const hasPrices = Object.hasOwn(payload, 'prices') && !ownerConflicts.includes('prices')
    if (!Object.keys(fields).length && !hasSchedule && !hasPrices && !Object.hasOwn(payload, 'notices') && ownerConflicts.length) {
      throw createError({ statusCode: 409, statusMessage: 'Владелец обновил все поля черновика. Живая карточка не изменилась.', data: { ownerConflicts } })
    }
    const write = await pendingVenueWrite(fields, tx)
    await db.venues.prepareUpdate({ ...venue, status: 'published' }, write)
    const gate = contentGate('venue', { ...venue, ...fields }, true)
    const { row, writingWarnings } = await updateVenueContent(id, write, null, gate, tx)
    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
    }
    await syncVenueContact({ venueId: id, actor: 'editor', phone: write.phone, address: write.address, previous: venue, pageStatus: venue.status, tx })
    await syncCoordinates({ subjectType: 'venue', subjectId: id, actor: 'editor', latitude: write.latitude, longitude: write.longitude, previous: venue, pageStatus: venue.status, tx })
    if (hasSchedule) {
      if (payload.schedule) {
        await saveSchedule('venue', id, payload.schedule, { actor: 'editor', pageStatus: venue.status }, tx)
      } else {
        await db.schedules.remove('venue', id, tx)
        await retireFactSlot('venue', id, 'hours', tx)
      }
    }
    if (hasPrices) {
      await setVenuePrices(id, venuePricesWriteSchema.parse(payload.prices), 'editor', venue.status, tx)
    }
    const target = await practicalTarget('venue', id)
    const notices = await stagedForApply(target, payload)
    if (notices) {
      await db.notices.replace('venue', id, notices.map(toNoticeWrite), tx)
      delete remaining.notices
      delete remaining.noticesStagedAt
    }
    if (ownerConflicts.length) {
      await savePendingDraftContent({ entityType: 'venue', entityId: id, publicationStatus: 'review', payload: remaining }, contentGate('venue', remaining.fields ?? {}, false), tx)
    } else {
      await db.editor.deleteContentDraftIfUnchanged(draft.id, draft.updatedAt, tx)
    }
    return { id, slug: row.slug, status: row.status, pendingReview: ownerConflicts.length > 0, ownerConflicts, writingWarnings, pricesChanged: hasPrices, regionId: row.regionId, previousRegionId: venue.regionId }
  })
  await syncSavedPage('venue', id)
  if (result.pricesChanged || result.regionId !== result.previousRegionId) {
    await recomputeTownPriceBands(result.regionId)
    if (result.previousRegionId !== result.regionId) {
      await recomputeTownPriceBands(result.previousRegionId)
    }
  }
  const { pricesChanged: _pricesChanged, regionId: _regionId, previousRegionId: _previousRegionId, ...response } = result
  const current = result.pricesChanged ? await db.venues.byId(id) : null
  return { ...response, warnings: current ? await storedPriceWarnings(current) : [] as VenuePriceWarning[] }
}
