import type { VenueDish, VenueReservation, VenueWrite } from '@k39/database'
import type { VenueModule } from '../../../shared/venue-modules'
import { db, VenueInputError } from '@k39/database'
import { createError } from 'h3'
import { rulesFromVenueHours, verifiedDate } from '../../../shared/schedule'
import { auditMcp } from '../mcp/audit'
import { parseFactsCheckedAt } from '../mcp/facts'
import { loadSchedule, saveSchedule } from '../schedule'
import { normalizeDishModules } from './dishes'

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
    const row = await db.venues.create({
      ...venueWriteFromInput({ ...input, modules }),
      regionId: regionId === undefined ? input.regionId : regionId,
    }, userId)
    await syncVenueSchedule(row, input)
    await auditMcp('venue_create', 'venue', row.id)
    return row
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
    const saved = await db.venues.update(current.id, {
      ...venueWriteFromInput({ ...input, modules }),
      regionId: regionId === undefined ? undefined : regionId,
      slug: input.slug && input.id ? input.slug : input.id ? undefined : current.slug,
    }, userId)
    if (!saved) {
      throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
    }
    await syncVenueSchedule(saved, input)
    await auditMcp('venue_update', 'venue', saved.id)
    return saved
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
  venue: { id: string, hours: unknown, lastVerifiedAt: Date | string | null },
  input: { hours?: unknown, lastVerifiedAt?: string | null },
) {
  if (input.hours === undefined && input.lastVerifiedAt === undefined) {
    return
  }
  const current = await loadSchedule('venue', venue.id)
  const rules = input.hours === undefined && current
    ? current.rules
    : rulesFromVenueHours(venue.hours as Parameters<typeof rulesFromVenueHours>[0])
  if (!rules) {
    return
  }
  await saveSchedule('venue', venue.id, {
    rules,
    sourceUrl: current?.sourceUrl ?? null,
    verifiedAt: rules.needsCheck ? null : verifiedDate(venue.lastVerifiedAt),
  })
}
