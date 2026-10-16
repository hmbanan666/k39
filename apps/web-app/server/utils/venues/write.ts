import type { VenueDish, VenueReservation, VenueWrite } from '@k39/database'
import type { FactActor } from '../../../shared/facts'
import type { VenueModule } from '../../../shared/venue-modules'
import { db, VenueInputError } from '@k39/database'
import { createError } from 'h3'
import { rulesFromVenueHours, verifiedDate } from '../../../shared/schedule'
import { writingCopy } from '../../../shared/writing'
import { syncPageSections } from '../facts/queue'
import { hoursConflict, syncVenueContact } from '../facts/sync'
import { auditMcp } from '../mcp/audit'
import { parseFactsCheckedAt } from '../mcp/facts'
import { writingGate } from '../mcp/writing-guard'
import { loadSchedule, saveSchedule } from '../schedule'
import { normalizeDishModules } from './dishes'
import { recomputePriceBandsAfterStatus } from './price-band'

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
  try {
    const regionId = await regionIdForSlug(input.regionSlug)
    const modules = input.modules ? await normalizeDishModules(null, input.modules as VenueModule[], 'editorial') : undefined
    const writingWarnings = writingGate(writingCopy([
      input.name,
      input.description,
      input.address,
      input.phone,
      input.seoTitle,
      input.seoDescription,
      input.signatureDishes,
      modules,
      input.sources,
    ]), input.status === 'published', true)
    const actor: FactActor = userId ? 'editor' : 'mcp'
    const row = await db.venues.create({
      ...venueWriteFromInput({ ...input, modules }),
      regionId: regionId === undefined ? input.regionId : regionId,
    }, userId)
    await syncVenueSchedule(row, input, actor)
    await syncVenueContact({
      venueId: row.id,
      actor,
      pageStatus: row.status,
      phone: input.phone,
      address: input.address,
      status: input.status,
      previous: { phone: null, address: null, status: 'draft' },
    })
    await syncPageSections('venue', row.id)
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
  try {
    const regionId = await regionIdForSlug(input.regionSlug)
    const modules = input.modules ? await normalizeDishModules(current.id, input.modules as VenueModule[], 'editorial') : undefined
    const status = input.status ?? current.status
    const writingWarnings = writingGate(writingCopy([
      input.name ?? current.name,
      input.description === undefined ? current.description : input.description,
      input.address === undefined ? current.address : input.address,
      input.phone === undefined ? current.phone : input.phone,
      input.seoTitle === undefined ? current.seoTitle : input.seoTitle,
      input.seoDescription === undefined ? current.seoDescription : input.seoDescription,
      input.signatureDishes === undefined ? current.signatureDishes : input.signatureDishes,
      modules === undefined ? current.modules : modules,
      input.sources === undefined ? current.sources : input.sources,
    ]), status === 'published', true)
    const actor: FactActor = userId ? 'editor' : 'mcp'
    let hoursQueue: string | null = null
    if (input.hours !== undefined) {
      const rules = rulesFromVenueHours(input.hours as Parameters<typeof rulesFromVenueHours>[0])
      if (rules) {
        const blocked = await hoursConflict('venue', current.id, {
          rules,
          sourceUrl: null,
          verifiedAt: verifiedDate(input.lastVerifiedAt === undefined ? current.lastVerifiedAt : input.lastVerifiedAt),
        }, actor)
        if (blocked) {
          hoursQueue = blocked.queueId
        }
      }
    }
    const contact = await syncVenueContact({
      venueId: current.id,
      actor,
      pageStatus: status,
      phone: input.phone,
      address: input.address,
      status: input.status,
      previous: { phone: current.phone, address: current.address, status: current.status },
    })
    const saved = await db.venues.update(current.id, {
      ...venueWriteFromInput({
        ...input,
        modules,
        phone: contact.skipped.phone ? undefined : input.phone,
        address: contact.skipped.address ? undefined : input.address,
        status: contact.skipped.status ? undefined : input.status,
        hours: hoursQueue ? undefined : input.hours,
      }),
      regionId: regionId === undefined ? undefined : regionId,
      slug: input.slug && input.id ? input.slug : input.id ? undefined : current.slug,
    }, userId)
    if (!saved) {
      throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
    }
    const hoursBlocked = hoursQueue || await syncVenueSchedule(saved, { hours: input.hours, lastVerifiedAt: input.lastVerifiedAt }, actor)
    await syncPageSections('venue', saved.id)
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

/**
 * Keep the venue schedule (ADR 0028) in step with venue writes. New hours
 * replace the rules; an editor check date marks them verified. A write that
 * touches neither leaves the schedule alone, so schedule_set edits survive.
 */
export async function syncVenueSchedule(
  venue: { id: string, hours: unknown, lastVerifiedAt: Date | string | null, status?: string },
  input: { hours?: unknown, lastVerifiedAt?: string | null },
  actor: FactActor = 'mcp',
) {
  if (input.hours === undefined && input.lastVerifiedAt === undefined) {
    return null
  }
  const current = await loadSchedule('venue', venue.id)
  const rules = input.hours === undefined && current
    ? current.rules
    : rulesFromVenueHours(venue.hours as Parameters<typeof rulesFromVenueHours>[0])
  if (!rules) {
    return null
  }
  const saved = await saveSchedule('venue', venue.id, {
    rules,
    sourceUrl: current?.sourceUrl ?? null,
    verifiedAt: rules.needsCheck ? null : verifiedDate(venue.lastVerifiedAt),
  }, { actor, pageStatus: venue.status })
  return saved.conflict ? saved.queueId : null
}
