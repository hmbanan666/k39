import type { SourceLink, VenueHours, VenueKind, VenueSocials, VenueStatus } from '@k39/database'
import { db } from '@k39/database'
import { haversineKm } from '../../../shared/links'
import { slugError, transliterateSlug } from '../../../shared/seo'
import { descriptionLengthError, overpassAreaError, overpassQuery, VENUE_KINDS, venueFromOsm, venueIsStale, venueKindBySlug, venueKindMeta } from '../../../shared/venues'
import { auditMcp } from '../mcp/audit'
import { parseFactsCheckedAt } from '../mcp/facts'
import { fetchOverpass } from './osm'

const KINDS = new Set<string>(VENUE_KINDS.map((item) => item.kind))
const STATUSES = new Set<string>(['draft', 'published', 'closed', 'archived'])
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export interface VenueInput {
  id?: string
  slug?: string
  name?: string
  kind?: string
  cuisine?: string[]
  regionSlug?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  priceLevel?: number | null
  avgCheck?: number | null
  hours?: VenueHours | null
  phone?: string | null
  website?: string | null
  socials?: VenueSocials | null
  description?: string
  sources?: SourceLink[]
  status?: string
  lastVerifiedAt?: string | null
  osmId?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  mediaIds?: string[]
}

function kindOf(value: string | undefined, fallback: VenueKind): VenueKind {
  if (!value) {
    return fallback
  }
  if (!KINDS.has(value)) {
    throw createError({ statusCode: 400, statusMessage: 'Неизвестный тип заведения' })
  }
  return value as VenueKind
}

function statusOf(value: string | undefined, fallback: VenueStatus): VenueStatus {
  if (!value) {
    return fallback
  }
  if (!STATUSES.has(value)) {
    throw createError({ statusCode: 400, statusMessage: 'Неизвестный статус' })
  }
  return value as VenueStatus
}

function cleanHours(hours: VenueHours | null | undefined, fallback: VenueHours): VenueHours {
  if (hours == null) {
    return fallback
  }
  const next: VenueHours = {}
  for (const day of WEEKDAYS) {
    const value = hours[day]
    if (value == null) {
      continue
    }
    next[day] = value.map((item) => ({
      open: item.open,
      close: item.close,
    }))
  }
  const note = hours.note?.trim()
  if (note) {
    next.note = note.slice(0, 300)
  }
  return next
}

function cleanCuisine(tags: string[] | undefined, fallback: string[]) {
  const source = tags ?? fallback
  return [...new Set(source.map((item) => item.trim().toLowerCase()).filter(Boolean))].slice(0, 12)
}

async function regionIdOf(slug: string | null | undefined, fallback: string | null) {
  if (slug === undefined) {
    return fallback
  }
  if (!slug) {
    return null
  }
  const region = await db.venues.regionBySlug(slug)
  if (!region) {
    throw createError({ statusCode: 400, statusMessage: 'Регион не найден' })
  }
  return region.id
}

async function assertSlug(slug: string, currentId?: string) {
  const problem = slugError(slug)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const region = await db.venues.regionBySlug(slug)
  if (region) {
    throw createError({ statusCode: 400, statusMessage: 'Адрес совпадает с регионом. Выберите другой.' })
  }
  if (venueKindBySlug(slug)) {
    throw createError({ statusCode: 400, statusMessage: 'Адрес совпадает с типом заведения. Выберите другой.' })
  }
  const taken = await db.venues.bySlug(slug)
  if (taken && taken.id !== currentId) {
    throw createError({ statusCode: 409, statusMessage: 'Такой адрес уже есть' })
  }
}

function compact(row: {
  id: string
  slug: string
  name: string
  kind: string
  status: string
  lastVerifiedAt: string | null
  osmId: string | null
}) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    status: row.status,
    lastVerifiedAt: row.lastVerifiedAt,
    stale: venueIsStale(row.lastVerifiedAt),
    osmId: row.osmId,
    path: `/zavedeniya/${row.slug}`,
  }
}

export async function createVenue(input: VenueInput, options?: { audit?: boolean }) {
  const slug = String(input.slug || '')
  const name = input.name?.trim() || ''
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Нужно название' })
  }
  await assertSlug(slug)
  const status = statusOf(input.status, 'draft')
  const description = input.description?.trim() || ''
  const lengthError = descriptionLengthError(description, status)
  if (lengthError) {
    throw createError({ statusCode: 400, statusMessage: lengthError })
  }
  const checked = parseFactsCheckedAt(input.lastVerifiedAt)
  try {
    const row = await db.venues.save({
      slug,
      name,
      kind: kindOf(input.kind, 'other'),
      cuisine: cleanCuisine(input.cuisine, []),
      regionId: await regionIdOf(input.regionSlug, null),
      address: input.address?.trim() || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      priceLevel: input.priceLevel ?? null,
      avgCheck: input.avgCheck ?? null,
      hours: cleanHours(input.hours, {}),
      phone: input.phone?.trim() || null,
      website: input.website?.trim() || null,
      socials: input.socials ?? {},
      description,
      sources: input.sources ?? [],
      status,
      lastVerifiedAt: checked === undefined ? null : checked,
      osmId: input.osmId?.trim() || null,
      seoTitle: input.seoTitle?.trim() || null,
      seoDescription: input.seoDescription?.trim() || null,
      mediaIds: input.mediaIds,
    })
    if (options?.audit !== false) {
      await auditMcp('venue_create', 'venue', row.id)
    }
    return compact(row)
  } catch (error) {
    if (error instanceof Error && error.message === 'venue-conflict') {
      throw createError({ statusCode: 409, statusMessage: 'Адрес или osmId уже занят' })
    }
    throw error
  }
}

export async function updateVenue(input: VenueInput, options?: { audit?: boolean }) {
  const current = input.id
    ? await db.venues.byId(input.id)
    : input.slug
      ? await db.venues.bySlug(input.slug)
      : null
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
  }
  const slug = input.slug || current.slug
  await assertSlug(slug, current.id)
  const status = statusOf(input.status, current.status)
  const description = input.description === undefined ? current.description : input.description
  const lengthError = descriptionLengthError(description, status)
  if (lengthError) {
    throw createError({ statusCode: 400, statusMessage: lengthError })
  }
  const checked = parseFactsCheckedAt(input.lastVerifiedAt)
  try {
    const row = await db.venues.save({
      id: current.id,
      slug,
      name: input.name?.trim() || current.name,
      kind: kindOf(input.kind, current.kind),
      cuisine: cleanCuisine(input.cuisine, current.cuisine ?? []),
      regionId: await regionIdOf(input.regionSlug, current.regionId),
      address: input.address === undefined ? current.address : input.address,
      latitude: input.latitude === undefined ? current.latitude : input.latitude,
      longitude: input.longitude === undefined ? current.longitude : input.longitude,
      priceLevel: input.priceLevel === undefined ? current.priceLevel : input.priceLevel,
      avgCheck: input.avgCheck === undefined ? current.avgCheck : input.avgCheck,
      hours: input.hours === undefined ? current.hours : cleanHours(input.hours, {}),
      phone: input.phone === undefined ? current.phone : input.phone,
      website: input.website === undefined ? current.website : input.website,
      socials: input.socials === undefined ? current.socials : (input.socials ?? {}),
      description,
      sources: input.sources ?? current.sources ?? [],
      status,
      lastVerifiedAt: checked === undefined ? current.lastVerifiedAt : checked,
      osmId: input.osmId === undefined ? current.osmId : input.osmId,
      seoTitle: input.seoTitle === undefined ? current.seoTitle : input.seoTitle,
      seoDescription: input.seoDescription === undefined ? current.seoDescription : input.seoDescription,
      mediaIds: input.mediaIds,
    })
    if (options?.audit !== false) {
      await auditMcp('venue_update', 'venue', current.id)
    }
    return compact(row)
  } catch (error) {
    if (error instanceof Error && error.message === 'venue-conflict') {
      throw createError({ statusCode: 409, statusMessage: 'Адрес или osmId уже занят' })
    }
    throw error
  }
}

export async function setVenueListingIntro(input: { regionSlug?: string | null, kind?: string | null, intro: string }) {
  const regionSlug = input.regionSlug?.trim() || ''
  const kindSlug = input.kind?.trim() || ''
  if (regionSlug) {
    const region = await db.venues.regionBySlug(regionSlug)
    if (!region) {
      throw createError({ statusCode: 400, statusMessage: 'Регион не найден' })
    }
  }
  if (kindSlug && !venueKindBySlug(kindSlug) && !KINDS.has(kindSlug)) {
    throw createError({ statusCode: 400, statusMessage: 'Неизвестный тип заведения' })
  }
  const storedKind = KINDS.has(kindSlug) ? venueKindMeta(kindSlug).slug : kindSlug
  const intro = input.intro.trim()
  if (intro.length > 2000) {
    throw createError({ statusCode: 400, statusMessage: 'Вступление длиннее 2000 знаков' })
  }
  const row = await db.venues.setListingIntro(regionSlug, storedKind, intro)
  await auditMcp('venue_listing_intro_set', 'venue_listing', row?.id)
  return {
    regionSlug,
    kind: storedKind,
    path: regionSlug
      ? (storedKind ? `/zavedeniya/${regionSlug}/${storedKind}` : `/zavedeniya/${regionSlug}`)
      : '/zavedeniya',
    intro,
  }
}

export async function importOsmVenues(area: {
  south?: number
  west?: number
  north?: number
  east?: number
  latitude?: number
  longitude?: number
  radius?: number
}) {
  const problem = overpassAreaError(area)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const elements = await fetchOverpass(overpassQuery({
    ...area,
    radius: area.radius ?? (area.latitude == null ? undefined : 1000),
  }))
  const drafts = elements.flatMap((element) => {
    const venue = venueFromOsm(element)
    return venue ? [venue] : []
  })
  const existing = await db.venues.existingOsmIds(drafts.map((item) => item.osmId))
  const fresh = drafts.filter((item) => !existing.has(item.osmId))
  const capped = fresh.slice(0, 200)
  const taken = await db.venues.slugs()
  const regionRows = await db.editor.listRegions()
  const regionSlugs = new Set(regionRows.map((item) => item.slug))
  const rows = capped.map((item) => {
    const slug = uniqueSlug(transliterateSlug(item.name), taken, regionSlugs, item.osmId)
    taken.add(slug)
    const region = nearestRegion(item.latitude, item.longitude, regionRows)
    return {
      slug,
      name: item.name,
      kind: item.kind,
      cuisine: item.cuisine,
      regionId: region?.id ?? null,
      address: item.address,
      latitude: item.latitude,
      longitude: item.longitude,
      hours: item.hours,
      phone: item.phone,
      website: item.website,
      socials: item.socials,
      description: '',
      sources: [{ title: 'OpenStreetMap', url: `https://www.openstreetmap.org/${item.osmId}` }],
      osmId: item.osmId,
      status: 'draft' as const,
    }
  })
  const created = await db.venues.insertDrafts(rows)
  await auditMcp('venue_import_osm', 'venue', null)
  return {
    fetched: elements.length,
    named: drafts.length,
    created: created.length,
    skipped: drafts.length - fresh.length,
    capped: fresh.length - capped.length,
    status: 'draft',
  }
}

function uniqueSlug(base: string, taken: Set<string>, regionSlugs: Set<string>, osmId: string) {
  const suffix = osmId.replace(/\W/g, '')
  let slug = base || `osm-${suffix}`
  if (slugError(slug) || regionSlugs.has(slug) || venueKindBySlug(slug)) {
    slug = `osm-${suffix}`.toLowerCase()
  }
  let candidate = slug
  let n = 2
  while (taken.has(candidate) || regionSlugs.has(candidate) || slugError(candidate)) {
    candidate = `${slug}-${n}`
    n += 1
  }
  return candidate
}

function nearestRegion(
  latitude: number,
  longitude: number,
  rows: Array<{ id: string, slug: string, latitude: number | null, longitude: number | null }>,
) {
  let best: { id: string } | null = null
  let bestKm = 30
  for (const row of rows) {
    if (row.latitude == null || row.longitude == null) {
      continue
    }
    const km = haversineKm(latitude, longitude, row.latitude, row.longitude)
    if (km < bestKm) {
      best = row
      bestKm = km
    }
  }
  return best
}
