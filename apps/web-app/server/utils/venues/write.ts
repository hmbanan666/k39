import type { VenueWrite } from '@k39/database'
import { db, VenueInputError } from '@k39/database'
import { createError } from 'h3'
import { auditMcp } from '../mcp/audit'
import { parseFactsCheckedAt } from '../mcp/facts'

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
    const row = await db.venues.create({
      ...venueWriteFromInput(input),
      regionId: regionId === undefined ? input.regionId : regionId,
    }, userId)
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
    const saved = await db.venues.update(current.id, {
      ...venueWriteFromInput(input),
      regionId: regionId === undefined ? undefined : regionId,
      slug: input.slug && input.id ? input.slug : input.id ? undefined : current.slug,
    }, userId)
    if (!saved) {
      throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
    }
    await auditMcp('venue_update', 'venue', saved.id)
    return saved
  } catch (error) {
    venueError(error)
  }
}
