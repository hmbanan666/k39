import type { VenueDish, VenueReservation, VenueWrite } from '@k39/database'
import type { FactActor } from '../../../shared/facts'
import type { ScheduleRecord } from '../../../shared/schedule'
import type { VenueModule } from '../../../shared/venue-modules'
import { db, normalizeHours, VenueInputError } from '@k39/database'
import { createError } from 'h3'
import { mergeWeeklyRules, rulesWithNote, verifiedDate, weeklyTableFits, weeklyTableKey, weeklyTableRules } from '../../../shared/schedule'
import { contentScope, requireEditorContent } from '../access'
import { contentGate, contentWarnings, createVenueContent, updateVenueContent } from '../content/save'
import { hoursConflict, syncCoordinates, syncVenueContact } from '../facts/sync'
import { auditMcp } from '../mcp/audit'
import { parseFactsCheckedAt } from '../mcp/facts'
import { loadSchedule, saveSchedule } from '../schedule'
import { normalizeDishModules } from './dishes'
import { recomputePriceBandsAfterStatus } from './price-band'

/** Editor token only. A published or closed venue stays; the repository refuses those. */
export async function deleteVenue(input: { id?: string, slug?: string }) {
  requireEditorContent('delete a venue')
  if (!input.id && !input.slug) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен id или slug' })
  }
  const current = input.id ? await db.venues.byId(input.id) : await db.venues.bySlug(input.slug || '')
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
  }
  try {
    const result = await db.venues.remove(current.id)
    if (!result) {
      throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
    }
    await auditMcp('venue_delete', 'venue', result.id)
    return result
  } catch (error) {
    if (error instanceof VenueInputError && error.message.startsWith('Удалить можно только')) {
      throw createError({ statusCode: 409, statusMessage: error.message })
    }
    venueError(error)
  }
}

export function venueError(error: unknown): never {
  if (error instanceof VenueInputError) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }
  throw error
}

export async function regionIdForSlug(slug: string | null | undefined) {
  if (slug === undefined) {
    return undefined
  }
  if (slug === null || slug === '') {
    return null
  }
  const region = await db.venues.regionBySlug(slug)
  if (!region) {
    throw createError({ statusCode: 400, statusMessage: 'Регион не найден' })
  }
  return region.id
}

export function venueWriteFromInput(input: {
  slug?: string
  name?: string
  kind?: string
  cuisineTags?: string[]
  regionId?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  priceLevel?: number | null
  avgCheck?: number | null
  hours?: unknown
  phone?: string | null
  website?: string | null
  socials?: Array<{ network: string, url: string }>
  vkCommunityId?: number | string | null
  bookingUrl?: string | null
  orderUrl?: string | null
  deliveryUrl?: string | null
  menuUrl?: string | null
  reservation?: VenueReservation | null
  takeaway?: boolean | null
  delivery?: boolean | null
  signatureDishes?: VenueDish[]
  modules?: unknown[]
  contactEmail?: string | null
  description?: string
  sources?: Array<{ title: string, url: string }>
  status?: 'draft' | 'published' | 'closed' | 'archived'
  lastVerifiedAt?: string | null
  osmId?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  noindex?: boolean
}): VenueWrite {
  return {
    ...input,
    lastVerifiedAt: parseFactsCheckedAt(input.lastVerifiedAt),
  }
}

export async function createVenue(input: Parameters<typeof venueWriteFromInput>[0] & { regionSlug?: string | null }, userId?: string | null) {
  if (contentScope() === 'draft' && input.status === 'published') {
    throw createError({ statusCode: 403, statusMessage: 'Draft token cannot publish' })
  }
  try {
    const regionId = await regionIdForSlug(input.regionSlug)
    const modules = input.modules ? await normalizeDishModules(null, input.modules as VenueModule[], 'editorial') : undefined
    const actor: FactActor = userId ? 'editor' : 'mcp'
    const { row, writingWarnings } = await createVenueContent({
      ...venueWriteFromInput({ ...input, modules }),
      regionId: regionId === undefined ? input.regionId : regionId,
    }, userId, contentGate('venue', { ...input, modules }, input.status === 'published'))
    await saveVenueSchedule(row, await planVenueSchedule({ id: row.id, lastVerifiedAt: null }, input), actor)
    await syncVenueContact({
      venueId: row.id,
      actor,
      pageStatus: row.status,
      phone: input.phone,
      address: input.address,
      status: input.status,
      previous: { phone: null, address: null, status: 'draft' },
    })
    await syncCoordinates({
      subjectType: 'venue',
      subjectId: row.id,
      actor,
      pageStatus: row.status,
      latitude: input.latitude,
      longitude: input.longitude,
      previous: { latitude: null, longitude: null },
    })
    await auditMcp('venue_create', 'venue', row.id)
    return { ...row, writingWarnings }
  } catch (error) {
    venueError(error)
  }
}

export async function updateVenue(input: Parameters<typeof venueWriteFromInput>[0] & { id?: string, regionSlug?: string | null }, userId?: string | null) {
  const current = input.id
    ? await db.venues.byId(input.id)
    : input.slug
      ? await db.venues.bySlug(input.slug)
      : null
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
  }
  if (contentScope() === 'draft' && (input.status === 'published' || current.status === 'published' || current.status === 'closed')) {
    throw createError({
      statusCode: input.status === 'published' ? 403 : 409,
      statusMessage: input.status === 'published'
        ? 'Draft token cannot publish'
        : 'Draft token cannot edit a published venue. The live page was not changed.',
    })
  }
  try {
    const regionId = await regionIdForSlug(input.regionSlug)
    const modules = input.modules ? await normalizeDishModules(current.id, input.modules as VenueModule[], 'editorial') : undefined
    const status = input.status ?? current.status
    const gate = contentGate('venue', {
      name: input.name === undefined ? current.name : input.name,
      description: input.description === undefined ? current.description : input.description,
      address: input.address === undefined ? current.address : input.address,
      phone: input.phone === undefined ? current.phone : input.phone,
      seoTitle: input.seoTitle === undefined ? current.seoTitle : input.seoTitle,
      seoDescription: input.seoDescription === undefined ? current.seoDescription : input.seoDescription,
      signatureDishes: input.signatureDishes === undefined ? current.signatureDishes : input.signatureDishes,
      modules: modules === undefined ? current.modules : modules,
      sources: input.sources === undefined ? current.sources : input.sources,
      website: input.website === undefined ? current.website : input.website,
      socials: input.socials === undefined ? current.socials : input.socials,
      bookingUrl: input.bookingUrl === undefined ? current.bookingUrl : input.bookingUrl,
      orderUrl: input.orderUrl === undefined ? current.orderUrl : input.orderUrl,
      deliveryUrl: input.deliveryUrl === undefined ? current.deliveryUrl : input.deliveryUrl,
      menuUrl: input.menuUrl === undefined ? current.menuUrl : input.menuUrl,
      contactEmail: input.contactEmail === undefined ? current.contactEmail : input.contactEmail,
    }, status === 'published')
    contentWarnings(gate)
    const actor: FactActor = userId ? 'editor' : 'mcp'
    const schedule = await planVenueSchedule(current, input)
    const hoursQueue = schedule ? (await hoursConflict('venue', current.id, schedule, actor))?.queueId ?? null : null
    const contact = await syncVenueContact({
      venueId: current.id,
      actor,
      pageStatus: status,
      phone: input.phone,
      address: input.address,
      status: input.status,
      previous: { phone: current.phone, address: current.address, status: current.status },
    })
    const point = await syncCoordinates({
      subjectType: 'venue',
      subjectId: current.id,
      actor,
      pageStatus: status,
      latitude: input.latitude,
      longitude: input.longitude,
      previous: { latitude: current.latitude, longitude: current.longitude },
    })
    const updated = await updateVenueContent(current.id, {
      ...venueWriteFromInput({
        ...input,
        modules,
        phone: contact.skipped.phone ? undefined : input.phone,
        address: contact.skipped.address ? undefined : input.address,
        status: contact.skipped.status ? undefined : input.status,
        latitude: point.skipped ? undefined : input.latitude,
        longitude: point.skipped ? undefined : input.longitude,
        hours: hoursQueue ? undefined : input.hours,
      }),
      regionId: regionId === undefined ? undefined : regionId,
      slug: input.slug && input.id ? input.slug : input.id ? undefined : current.slug,
    }, userId, gate)
    const saved = updated.row
    const writingWarnings = updated.writingWarnings
    if (!saved) {
      throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
    }
    const hoursBlocked = hoursQueue || await saveVenueSchedule(saved, schedule, actor)
    await recomputePriceBandsAfterStatus(
      { regionId: current.regionId, status: current.status },
      { regionId: saved.regionId, status: saved.status },
    )
    await auditMcp('venue_update', 'venue', saved.id)
    return { ...saved, writingWarnings, ownerConflicts: [...contact.conflicts, ...(hoursBlocked ? [hoursBlocked] : [])] }
  } catch (error) {
    venueError(error)
  }
}

export const SCHEDULE_ONLY_HOURS = 'Часы этого заведения заданы расписанием (сезоны, перерывы или особый режим). Таблица их не покажет целиком, поэтому меняйте их через schedule_set.'

export const HOURS_NOT_SAVED = 'Часы не сохранены: проверьте время по дням и заметку'

/**
 * The schedule a venue write stores, or null when the write leaves it alone.
 * The `schedules` row is the only source of venue hours (ADR 0028). `hours`
 * from a form or `venue_update` is a weekly table: `days` replace the week and
 * unknown days of its one season, and `note` the note. A missing `days` keeps
 * the stored week, so a note-only write changes only the note, on any rules.
 * Other seasons, closures, exceptions, holidays, slots and the source URL
 * stay. `days` against rules a table cannot show are refused with 409. Hours
 * equal to the stored ones are no write. A changed editor check date marks the
 * schedule verified; otherwise the stored check date stays. Invalid hours are
 * a `VenueInputError` (400).
 */
export async function planVenueSchedule(
  venue: { id: string, lastVerifiedAt: Date | string | null },
  input: { hours?: unknown, lastVerifiedAt?: string | null },
): Promise<ScheduleRecord | null> {
  const current = await loadSchedule('venue', venue.id)
  let rules = current?.rules ?? null
  let hoursChanged = false
  const sent = input.hours && typeof input.hours === 'object' ? input.hours as { days?: unknown } : null
  const sendsDays = Array.isArray(sent?.days)
  const sendsNote = Boolean(sent && 'note' in sent)
  if (sent && (sendsDays || sendsNote)) {
    const hours = normalizeHours(sent)
    if (sendsDays) {
      if (!weeklyTableFits(rules)) {
        throw createError({ statusCode: 409, statusMessage: SCHEDULE_ONLY_HOURS })
      }
      const table = weeklyTableRules(hours)
      if (!table) {
        throw new VenueInputError(HOURS_NOT_SAVED)
      }
      const season = table.seasons[0]
      const states = Boolean(season?.week.length || season?.unknownDays?.length || table.note)
      if (rules || states) {
        const merged = mergeWeeklyRules(rules, table, { note: sendsNote })
        if (!merged) {
          throw new VenueInputError(HOURS_NOT_SAVED)
        }
        if (!rules || weeklyTableKey(merged) !== weeklyTableKey(rules)) {
          rules = merged
          hoursChanged = true
        }
      }
    } else if (rules || hours.note) {
      const next = rulesWithNote(rules, hours.note)
      if (!next) {
        throw new VenueInputError(HOURS_NOT_SAVED)
      }
      if (!rules || (next.note ?? '') !== (rules.note ?? '')) {
        rules = next
        hoursChanged = true
      }
    }
  }
  const checkChanged = input.lastVerifiedAt !== undefined && verifiedDate(input.lastVerifiedAt) !== verifiedDate(venue.lastVerifiedAt)
  if (!rules || (!hoursChanged && !checkChanged)) {
    return null
  }
  const checkedOn = checkChanged ? verifiedDate(input.lastVerifiedAt) : current?.verifiedAt ?? verifiedDate(venue.lastVerifiedAt)
  return {
    rules,
    sourceUrl: current?.sourceUrl ?? null,
    verifiedAt: rules.needsCheck ? null : checkedOn,
  }
}

/**
 * OSM opening hours of newly imported drafts as unverified schedules. A draft
 * whose hours are invalid input never stops the rest: its osmId is returned
 * and the draft keeps unknown hours. Any other error fails the import.
 */
export async function saveImportedHours(created: Array<{ id: string, draft: { osmId: string, hours: unknown, sources: Array<{ url: string }> } }>) {
  const hoursSkipped: string[] = []
  for (const { id, draft } of created) {
    try {
      const schedule = await planVenueSchedule({ id, lastVerifiedAt: null }, { hours: draft.hours })
      await saveVenueSchedule({ id, status: 'draft' }, schedule && { ...schedule, sourceUrl: draft.sources[0]?.url ?? null, verifiedAt: null }, 'mcp')
    } catch (error) {
      if (!(error instanceof VenueInputError)) {
        throw error
      }
      hoursSkipped.push(draft.osmId)
    }
  }
  return hoursSkipped
}

/** Store a planned venue schedule. Returns the queue id when an owner fact blocked it. */
export async function saveVenueSchedule(venue: { id: string, status?: string }, record: ScheduleRecord | null, actor: FactActor = 'mcp') {
  if (!record) {
    return null
  }
  const saved = await saveSchedule('venue', venue.id, record, { actor, pageStatus: venue.status })
  return saved.conflict ? saved.queueId : null
}
