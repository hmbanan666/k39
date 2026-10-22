import type { SourceLink } from '../types/entities'
import type { OsmDraft, VenueDish, VenueLocality, VenuePhotoOrigin, VenueReservation, VenueSocial, VenueStatus } from '../venues'
import { ownWebsiteMessage, ownWebsiteProblem } from '@k39/types/official-url'
import { parseVkCommunityId, vkCommunityIdProblem } from '@k39/types/vk-community'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { firstPublishedStamp } from '../first-published'
import { PHONE_TEXT_MAX } from '../phone'
import { priceInName, priceInNameMessage } from '../price-label'
import { prepareSourceLinks, SourceInputError } from '../sources'
import { admissionPrices, calendarEvents, media, offers, regions, revisions, slugRedirects, venueListingIntros, venueMedia, venues } from '../tables'
import {
  assertKind,
  assertVenueSlug,
  descriptionPublishError,
  emptyHours,
  FOOD_KINDS,
  haversineKm,
  isBlockedVenueSlug,
  isFoodKind,
  NEARBY_MAX_DAYS,
  NEARBY_RADIUS_KM,
  normalizeHours,
  SIGNATURE_DISHES_MAX,
  STALE_DAYS,
  transliterateVenueSlug,
  VenueInputError,
  venueNameKey,
  venueSlugCandidates,
} from '../venues'
import { Notices } from './notices'

export interface VenueWrite {
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
  socials?: VenueSocial[]
  /** Numeric VK community id for a screen-name link in socials (ADR 0048). Null clears it. */
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
  sources?: SourceLink[]
  status?: VenueStatus
  lastVerifiedAt?: string | null
  osmId?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  noindex?: boolean
  locality?: VenueLocality | null
}

export interface VenueListFilter {
  regionId?: string | null
  kind?: string
  status?: VenueStatus
  stale?: boolean
  near?: { latitude: number, longitude: number, radiusKm: number }
  foodOnly?: boolean
  limit?: number
  /** Name or slug contains this text. Lower case, ё folded to е. */
  query?: string
}

function cleanText(value: string | null | undefined, max: number) {
  if (value == null) {
    return null
  }
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function cleanTags(tags: string[] | undefined) {
  if (!tags) {
    return undefined
  }
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0 && tag.length <= 40))].slice(0, 12)
}

function cleanSocials(rows: VenueSocial[] | undefined) {
  if (!rows) {
    return undefined
  }
  return rows
    .map((row) => ({ network: row.network.trim().toLowerCase().slice(0, 24), url: row.url.trim().slice(0, 300) }))
    .filter((row) => row.network && /^https?:\/\//.test(row.url))
    .slice(0, 8)
}

/** The same «Сайт» rule as a place (`ownWebsiteProblem`). */
function cleanWebsite(value: string | null | undefined) {
  const text = cleanText(value, 300)
  const problem = text ? ownWebsiteProblem(text) : null
  if (problem) {
    throw new VenueInputError(ownWebsiteMessage(problem))
  }
  return text
}

/**
 * The stored VK community id after a write. An explicit value must be a
 * positive integer that belongs to a VK link in `socials`. Without one, the
 * stored id stays only while it still passes that check against the new
 * `socials`, and clears otherwise. An owner edits socials without seeing this
 * field, so an owner save never fails on it and never leaves a stale id.
 * A screen-name change keeps the id: the check cannot tell a rename from a move.
 */
function nextVkCommunityId(input: VenueWrite['vkCommunityId'], current: number | null, socials: VenueSocial[]) {
  if (input === undefined) {
    return current != null && vkCommunityIdProblem(current, socials) === null ? current : null
  }
  const id = parseVkCommunityId(input)
  if (id === 'invalid') {
    throw new VenueInputError('ID сообщества ВКонтакте: целое положительное число, например 236300695')
  }
  const problem = vkCommunityIdProblem(id, socials)
  if (problem === 'no_vk_link') {
    throw new VenueInputError('ID сообщества ВКонтакте задаётся вместе со ссылкой на это сообщество в «Соцсети»')
  }
  if (problem === 'mismatch') {
    throw new VenueInputError('ID сообщества ВКонтакте не совпадает со ссылкой в «Соцсети»')
  }
  return id
}

function cleanUrl(value: string | null | undefined) {
  const text = cleanText(value, 500)
  if (text && !/^https?:\/\//i.test(text)) {
    throw new VenueInputError('Ссылка должна начинаться с http:// или https://')
  }
  return text
}

function cleanEmail(value: string | null | undefined) {
  if (value == null) {
    return null
  }
  const text = value.trim().toLowerCase().slice(0, 120)
  if (!text) {
    return null
  }
  if (!/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(text)) {
    throw new VenueInputError('Почта заведения выглядит неверно')
  }
  return text
}

function cleanDishes(rows: VenueDish[] | undefined) {
  if (!rows) {
    return undefined
  }
  return rows
    .map((row) => {
      const name = row.name.trim().slice(0, 80)
      if (name && priceInName(name)) {
        throw new VenueInputError(`${priceInNameMessage()}: ${name}`)
      }
      return {
        name,
        note: row.note?.trim().slice(0, 160) || null,
        priceRub: row.priceRub != null && Number.isFinite(row.priceRub) && row.priceRub >= 0 ? Math.round(row.priceRub) : null,
      }
    })
    .filter((row) => row.name)
    .slice(0, SIGNATURE_DISHES_MAX)
}

function cleanSources(rows: SourceLink[] | undefined) {
  try {
    return prepareSourceLinks(rows)
  } catch (error) {
    if (error instanceof SourceInputError) {
      throw new VenueInputError(error.message)
    }
    throw error
  }
}

function assertMoney(priceLevel: number | null | undefined, avgCheck: number | null | undefined) {
  if (priceLevel != null && (!Number.isInteger(priceLevel) || priceLevel < 1 || priceLevel > 4)) {
    throw new VenueInputError('Уровень цен: от 1 до 4')
  }
  if (avgCheck != null && (!Number.isInteger(avgCheck) || avgCheck < 0 || avgCheck > 1_000_000)) {
    throw new VenueInputError('Средний чек: целое число рублей')
  }
}

function assertPoint(latitude: number | null | undefined, longitude: number | null | undefined) {
  if (latitude == null && longitude == null) {
    return
  }
  if (latitude == null || longitude == null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new VenueInputError('Координаты вне диапазона')
  }
}

function errorChain(error: unknown) {
  const rows: Array<Record<string, unknown>> = []
  let current: unknown = error
  for (let depth = 0; current && typeof current === 'object' && depth < 5; depth += 1) {
    rows.push(current as Record<string, unknown>)
    current = (current as { cause?: unknown }).cause
  }
  return rows
}

function uniqueKind(error: unknown): 'slug' | 'osm' | 'unknown' | null {
  const rows = errorChain(error)
  if (!rows.some((row) => row.code === '23505')) {
    return null
  }
  const blob = rows.map((row) => {
    const parts: string[] = []
    for (const key of ['constraint', 'constraint_name', 'detail']) {
      if (typeof row[key] === 'string') {
        parts.push(row[key])
      }
    }
    if (typeof row.message === 'string' && /duplicate key|unique constraint/i.test(row.message)) {
      parts.push(row.message)
    }
    return parts.join(' ')
  }).join(' ').toLowerCase()
  if (/venues_osm_id_unique|\(osm_id\)/.test(blob)) {
    return 'osm'
  }
  if (/venues_slug_unique|\(slug\)/.test(blob)) {
    return 'slug'
  }
  return 'unknown'
}

async function uniqueError(error: unknown, slug: string, osmId: string | null) {
  const kind = uniqueKind(error)
  if (!kind) {
    return null
  }
  if (kind === 'osm') {
    return new VenueInputError('Такой osmId уже есть')
  }
  if (kind === 'slug') {
    return new VenueInputError('Такой адрес уже есть')
  }
  const slugTaken = Boolean(await Venues.bySlug(slug))
  const osmTaken = Boolean(osmId && await Venues.byOsmId(osmId))
  if (osmTaken && !slugTaken) {
    return new VenueInputError('Такой osmId уже есть')
  }
  if (slugTaken && osmTaken) {
    return new VenueInputError('Такой адрес уже есть. Такой osmId уже есть')
  }
  return new VenueInputError('Такой адрес уже есть')
}

async function localityFor(input: VenueWrite) {
  const town = input.locality?.town?.trim() || ''
  const district = input.locality?.district?.trim() || ''
  if (town || district) {
    return { town: town || null, district: district || null }
  }
  if (!input.regionId) {
    return null
  }
  const [region] = await useDatabase().select({ slug: regions.slug }).from(regions).where(eq(regions.id, input.regionId)).limit(1)
  return region ? { town: region.slug } : null
}

async function allocateSlug(base: string, reserved: ReadonlySet<string>, locality: VenueLocality | null) {
  for (const candidate of venueSlugCandidates(base, locality)) {
    if (isBlockedVenueSlug(candidate, reserved)) {
      continue
    }
    if (await Venues.bySlug(candidate)) {
      continue
    }
    return candidate
  }
  return null
}

async function reservedSlugs() {
  const rows = await useDatabase().select({ slug: regions.slug }).from(regions)
  return new Set(rows.map((row) => row.slug))
}

async function markGone(fromPath: string) {
  const db = useDatabase()
  const [existing] = await db.select().from(slugRedirects).where(eq(slugRedirects.fromPath, fromPath)).limit(1)
  if (!existing) {
    await db.insert(slugRedirects).values({ fromPath, toPath: null, statusCode: 410 })
    return
  }
  await db.update(slugRedirects).set({ toPath: null, statusCode: 410 }).where(eq(slugRedirects.id, existing.id))
}

async function clearGone(fromPath: string) {
  await useDatabase().delete(slugRedirects).where(and(eq(slugRedirects.fromPath, fromPath), eq(slugRedirects.statusCode, 410)))
}

async function rememberSlug(fromSlug: string, toSlug: string) {
  const fromPath = `/zavedeniya/${fromSlug}`
  const toPath = `/zavedeniya/${toSlug}`
  const db = useDatabase()
  const [existing] = await db.select().from(slugRedirects).where(eq(slugRedirects.fromPath, fromPath)).limit(1)
  if (!existing) {
    await db.insert(slugRedirects).values({ fromPath, toPath, statusCode: 301 })
    return
  }
  await db.update(slugRedirects).set({ toPath, statusCode: 301 }).where(eq(slugRedirects.id, existing.id))
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }
  return (result as { rows?: T[] }).rows ?? []
}

function numArray(values: number[]) {
  return sql`array[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::float8[]`
}

export class Venues {
  static async byId(id: string) {
    const [row] = await useDatabase().select().from(venues).where(eq(venues.id, id)).limit(1)
    return row ?? null
  }

  static async bySlug(slug: string) {
    const [row] = await useDatabase().select().from(venues).where(eq(venues.slug, slug)).limit(1)
    return row ?? null
  }

  static async byOsmId(osmId: string) {
    const [row] = await useDatabase().select().from(venues).where(eq(venues.osmId, osmId)).limit(1)
    return row ?? null
  }

  static async regionBySlug(slug: string) {
    const [row] = await useDatabase().select().from(regions).where(eq(regions.slug, slug)).limit(1)
    return row ?? null
  }

  static async create(input: VenueWrite, userId?: string | null) {
    const name = input.name?.trim()
    if (!name) {
      throw new VenueInputError('Нужно название')
    }
    if (!input.kind) {
      throw new VenueInputError('Нужен тип заведения')
    }
    assertKind(input.kind)
    const reserved = await reservedSlugs()
    const requested = input.slug?.trim() || ''
    const explicitSlug = requested.length > 0
    let slug = explicitSlug ? requested : transliterateVenueSlug(name)
    if (!slug) {
      throw new VenueInputError('Адрес: только латиница, цифры и дефисы')
    }
    if (!explicitSlug) {
      const allocated = await allocateSlug(slug, reserved, await localityFor(input))
      if (!allocated) {
        throw new VenueInputError('Такой адрес уже есть')
      }
      slug = allocated
    }
    assertVenueSlug(slug, reserved)
    const status = input.status ?? 'draft'
    const description = input.description ?? ''
    if (status === 'published') {
      const problem = descriptionPublishError(description)
      if (problem) {
        throw new VenueInputError(problem)
      }
    }
    assertMoney(input.priceLevel, input.avgCheck)
    assertPoint(input.latitude, input.longitude)
    const hours = input.hours === undefined ? emptyHours() : normalizeHours(input.hours)
    const socials = cleanSocials(input.socials) ?? []
    const vkCommunityId = nextVkCommunityId(input.vkCommunityId, null, socials)
    try {
      const [created] = await useDatabase().insert(venues).values({
        slug,
        name: name.slice(0, 160),
        kind: input.kind,
        cuisineTags: cleanTags(input.cuisineTags) ?? [],
        regionId: input.regionId ?? null,
        address: cleanText(input.address, 300),
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        priceLevel: input.priceLevel ?? null,
        avgCheck: input.avgCheck ?? null,
        hours,
        phone: cleanText(input.phone, PHONE_TEXT_MAX),
        website: cleanWebsite(input.website),
        socials,
        vkCommunityId,
        bookingUrl: cleanUrl(input.bookingUrl),
        orderUrl: cleanUrl(input.orderUrl),
        deliveryUrl: cleanUrl(input.deliveryUrl),
        menuUrl: cleanUrl(input.menuUrl),
        reservation: input.reservation ?? null,
        takeaway: input.takeaway ?? null,
        delivery: input.delivery ?? null,
        signatureDishes: cleanDishes(input.signatureDishes) ?? [],
        modules: input.modules ?? [],
        contactEmail: cleanEmail(input.contactEmail),
        description,
        sources: cleanSources(input.sources) ?? [],
        status,
        firstPublishedAt: firstPublishedStamp(null, status),
        lastVerifiedAt: input.lastVerifiedAt ?? null,
        osmId: cleanText(input.osmId, 80),
        seoTitle: cleanText(input.seoTitle, 180),
        seoDescription: cleanText(input.seoDescription, 300),
        noindex: input.noindex ?? false,
        updatedBy: userId ?? null,
      }).returning()
      if (!created) {
        throw new VenueInputError('Не удалось сохранить заведение')
      }
      if (status === 'archived') {
        await markGone(`/zavedeniya/${created.slug}`)
      }
      return created
    } catch (error) {
      const clash = await uniqueError(error, slug, cleanText(input.osmId, 80))
      throw clash ?? error
    }
  }

  static async update(id: string, input: VenueWrite, userId?: string | null) {
    const current = await this.byId(id)
    if (!current) {
      return null
    }
    const nextStatus = input.status ?? current.status
    const nextDescription = input.description ?? current.description
    if (nextStatus === 'published') {
      const problem = descriptionPublishError(nextDescription)
      if (problem) {
        throw new VenueInputError(problem)
      }
    }
    if (input.kind) {
      assertKind(input.kind)
    }
    const nextSlug = input.slug?.trim() || current.slug
    if (nextSlug !== current.slug) {
      assertVenueSlug(nextSlug, await reservedSlugs())
    }
    const latitude = input.latitude === undefined ? current.latitude : input.latitude
    const longitude = input.longitude === undefined ? current.longitude : input.longitude
    assertPoint(latitude, longitude)
    const priceLevel = input.priceLevel === undefined ? current.priceLevel : input.priceLevel
    const avgCheck = input.avgCheck === undefined ? current.avgCheck : input.avgCheck
    assertMoney(priceLevel, avgCheck)
    const hours = input.hours === undefined ? current.hours : normalizeHours(input.hours)
    const socials = cleanSocials(input.socials) ?? current.socials
    const next = {
      slug: nextSlug,
      name: input.name === undefined ? current.name : input.name.trim().slice(0, 160),
      kind: input.kind ?? current.kind,
      cuisineTags: cleanTags(input.cuisineTags) ?? current.cuisineTags,
      regionId: input.regionId === undefined ? current.regionId : input.regionId,
      address: input.address === undefined ? current.address : cleanText(input.address, 300),
      latitude,
      longitude,
      priceLevel,
      avgCheck,
      hours,
      phone: input.phone === undefined ? current.phone : cleanText(input.phone, PHONE_TEXT_MAX),
      website: input.website === undefined ? current.website : cleanWebsite(input.website),
      socials,
      vkCommunityId: nextVkCommunityId(input.vkCommunityId, current.vkCommunityId, socials),
      bookingUrl: input.bookingUrl === undefined ? current.bookingUrl : cleanUrl(input.bookingUrl),
      orderUrl: input.orderUrl === undefined ? current.orderUrl : cleanUrl(input.orderUrl),
      deliveryUrl: input.deliveryUrl === undefined ? current.deliveryUrl : cleanUrl(input.deliveryUrl),
      menuUrl: input.menuUrl === undefined ? current.menuUrl : cleanUrl(input.menuUrl),
      reservation: input.reservation === undefined ? current.reservation : input.reservation,
      takeaway: input.takeaway === undefined ? current.takeaway : input.takeaway,
      delivery: input.delivery === undefined ? current.delivery : input.delivery,
      signatureDishes: cleanDishes(input.signatureDishes) ?? current.signatureDishes,
      modules: input.modules ?? current.modules,
      contactEmail: input.contactEmail === undefined ? current.contactEmail : cleanEmail(input.contactEmail),
      description: nextDescription,
      sources: cleanSources(input.sources) ?? current.sources,
      status: nextStatus,
      firstPublishedAt: firstPublishedStamp(current.firstPublishedAt, nextStatus),
      lastVerifiedAt: input.lastVerifiedAt === undefined ? current.lastVerifiedAt : input.lastVerifiedAt,
      osmId: input.osmId === undefined ? current.osmId : cleanText(input.osmId, 80),
      seoTitle: input.seoTitle === undefined ? current.seoTitle : cleanText(input.seoTitle, 180),
      seoDescription: input.seoDescription === undefined ? current.seoDescription : cleanText(input.seoDescription, 300),
      noindex: input.noindex ?? current.noindex,
    }
    // Price band, updatedAt, and updatedBy are derived. An equal row writes nothing.
    // firstPublishedAt stays in the comparison: a first publish is a change, a later edit keeps the stored instant.
    if (sameVenueWrite(current, next)) {
      return { ...current, unchanged: true as const }
    }
    await useDatabase().insert(revisions).values({
      entityType: 'venue',
      entityId: current.id,
      snapshot: current,
      updatedBy: userId ?? null,
    })
    if (nextSlug !== current.slug) {
      await rememberSlug(current.slug, nextSlug)
    }
    try {
      const [updated] = await useDatabase().update(venues).set({
        ...next,
        updatedBy: userId ?? null,
        updatedAt: new Date().toISOString(),
      }).where(eq(venues.id, current.id)).returning()
      const saved = updated ?? current
      const path = `/zavedeniya/${saved.slug}`
      if (nextStatus === 'archived') {
        await markGone(path)
      } else if (current.status === 'archived') {
        await clearGone(path)
        if (current.slug !== saved.slug) {
          await clearGone(`/zavedeniya/${current.slug}`)
        }
      }
      return { ...saved, unchanged: false as const }
    } catch (error) {
      const nextOsm = input.osmId === undefined ? current.osmId : cleanText(input.osmId, 80)
      const clash = await uniqueError(error, nextSlug, nextOsm)
      throw clash ?? error
    }
  }

  static async remove(id: string) {
    const current = await this.byId(id)
    if (!current) {
      return null
    }
    if (current.status !== 'draft' && current.status !== 'archived') {
      throw new VenueInputError('Удалить можно только черновик или архив')
    }
    await useDatabase().transaction(async (tx) => {
      await tx.delete(admissionPrices).where(and(eq(admissionPrices.subjectType, 'venue'), eq(admissionPrices.subjectId, current.id)))
      await tx.delete(calendarEvents).where(and(eq(calendarEvents.subjectType, 'venue'), eq(calendarEvents.subjectId, current.id)))
      await Notices.removeForSubject('venue', current.id, tx)
      await tx.delete(venues).where(eq(venues.id, current.id))
    })
    return { id: current.id, slug: current.slug, action: 'deleted' as const }
  }

  /** Website, social links, and the VK community id for the VK menu rule. A missing id is omitted. */
  static async menuLinksFor(ids: string[]) {
    const unique = [...new Set(ids)]
    if (!unique.length) {
      return []
    }
    return useDatabase().select({
      id: venues.id,
      website: venues.website,
      socials: venues.socials,
      vkCommunityId: venues.vkCommunityId,
    }).from(venues).where(inArray(venues.id, unique))
  }

  /** Every venue in a town, including drafts. A null region is its own group. */
  static async inRegion(regionId: string | null) {
    const where = regionId == null ? isNull(venues.regionId) : eq(venues.regionId, regionId)
    return useDatabase().select({
      id: venues.id,
      slug: venues.slug,
      regionId: venues.regionId,
      status: venues.status,
    }).from(venues).where(where)
  }

  /** Stores the computed comparison without a revision and without touching updatedAt. */
  static async setPriceBand(id: string, value: { level: 'low' | 'mid' | 'high' | null, basis: number, computedAt: string }) {
    await useDatabase().update(venues).set({
      priceBand: value.level,
      priceBandBasis: value.basis,
      priceBandComputedAt: value.computedAt,
    }).where(eq(venues.id, id))
  }

  static async list(filter: VenueListFilter = {}) {
    const where = venueListWhere(filter)
    const base = useDatabase().select().from(venues).where(where.length ? and(...where) : undefined).orderBy(asc(venues.name), asc(venues.id))
    const rows = filter.limit ? await base.limit(filter.limit) : await base
    if (!filter.near) {
      return rows.map((row) => ({ ...row, distanceKm: null as number | null }))
    }
    const { latitude, longitude, radiusKm } = filter.near
    return rows.flatMap((row) => {
      if (row.latitude == null || row.longitude == null) {
        return []
      }
      const distanceKm = haversineKm(latitude, longitude, row.latitude, row.longitude)
      if (distanceKm > radiusKm) {
        return []
      }
      return [{ ...row, distanceKm }]
    }).sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || a.id.localeCompare(b.id))
  }

  /**
   * One page of `list`, ordered by name then id, with the filtered count.
   * `near` is applied before the slice so `total` counts only rows inside the radius.
   * pageSize stops at 50, the same cap as `places_list`.
   */
  static async listPage(filter: VenueListFilter & { page?: number, pageSize?: number } = {}) {
    const page = Math.max(1, Math.floor(filter.page ?? 1))
    const pageSize = Math.min(50, Math.max(1, Math.floor(filter.pageSize ?? 20)))
    const where = venueListWhere(filter)
    const clause = where.length ? and(...where) : undefined
    const ordered = () => useDatabase().select().from(venues).where(clause).orderBy(asc(venues.name), asc(venues.id))
    if (filter.near) {
      const rows = await ordered()
      const { latitude, longitude, radiusKm } = filter.near
      const matched = rows.flatMap((row) => {
        if (row.latitude == null || row.longitude == null) {
          return []
        }
        const distanceKm = haversineKm(latitude, longitude, row.latitude, row.longitude)
        if (distanceKm > radiusKm) {
          return []
        }
        return [{ ...row, distanceKm }]
      })
      const start = (page - 1) * pageSize
      return { items: matched.slice(start, start + pageSize), total: matched.length, page, pageSize }
    }
    const [rows, countRows] = await Promise.all([
      ordered().limit(pageSize).offset((page - 1) * pageSize),
      useDatabase().select({ value: sql<number>`count(*)::int` }).from(venues).where(clause),
    ])
    return {
      items: rows.map((row) => ({ ...row, distanceKm: null as number | null })),
      total: Number(countRows[0]?.value ?? 0),
      page,
      pageSize,
    }
  }

  /**
   * Venues that share a normalized name or sit within `radiusM` of a point.
   * Includes every status, so an archived card is not created again.
   */
  static async findDuplicates(input: {
    name?: string
    latitude?: number
    longitude?: number
    radiusM?: number
    regionId?: string
  }) {
    const key = input.name ? venueNameKey(input.name) : ''
    const latitude = input.latitude
    const longitude = input.longitude
    const hasPoint = latitude != null && longitude != null
    const radiusM = Math.min(2000, Math.max(1, Math.floor(input.radiusM ?? 150)))
    const where = input.regionId ? eq(venues.regionId, input.regionId) : undefined
    const rows = await useDatabase().select({
      id: venues.id,
      slug: venues.slug,
      name: venues.name,
      kind: venues.kind,
      status: venues.status,
      latitude: venues.latitude,
      longitude: venues.longitude,
      regionSlug: regions.slug,
      regionTitle: regions.title,
    }).from(venues).leftJoin(regions, eq(venues.regionId, regions.id)).where(where)
    const items = rows.flatMap((row) => {
      const matched: Array<'name' | 'coordinates'> = []
      if (key && venueNameKey(row.name) === key) {
        matched.push('name')
      }
      let distanceM: number | null = null
      if (hasPoint && row.latitude != null && row.longitude != null) {
        distanceM = Math.round(haversineKm(latitude, longitude, row.latitude, row.longitude) * 1000)
        if (distanceM <= radiusM) {
          matched.push('coordinates')
        }
      }
      if (!matched.length) {
        return []
      }
      return [{
        id: row.id,
        slug: row.slug,
        name: row.name,
        kind: row.kind,
        status: row.status,
        region: row.regionSlug ? { slug: row.regionSlug, title: row.regionTitle ?? row.regionSlug } : null,
        distanceM,
        matched,
      }]
    })
    items.sort((a, b) => {
      const left = a.distanceM ?? Number.POSITIVE_INFINITY
      const right = b.distanceM ?? Number.POSITIVE_INFINITY
      return left - right || a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id)
    })
    return items
  }

  static async nearby(origins: Array<{ latitude: number, longitude: number }>, now = new Date()) {
    const points = origins.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
    if (!points.length) {
      return []
    }
    const cutoff = new Date(now.getTime() - NEARBY_MAX_DAYS * 86_400_000).toISOString()
    const result = await useDatabase().execute(sql`
      select v.id, v.slug, v.name, v.kind, v.address, v.phone, v.price_level, v.avg_check,
        v.last_verified_at, v.latitude, v.longitude, v.description, v.cuisine_tags, v.region_id,
        d.distance_km
      from venues v
      cross join lateral (
        select min(6371 * acos(least(1::float8, greatest(-1::float8,
          cos(radians(o.lat)) * cos(radians(v.latitude)) * cos(radians(v.longitude) - radians(o.lng))
          + sin(radians(o.lat)) * sin(radians(v.latitude))
        )))) as distance_km
        from unnest(${numArray(points.map((point) => point.latitude))}, ${numArray(points.map((point) => point.longitude))}) as o(lat, lng)
      ) d
      where v.status = 'published'
        and v.kind = any(${sql`array[${sql.join(FOOD_KINDS.map((kind) => sql`${kind}`), sql`, `)}]::varchar[]`})
        and v.latitude is not null
        and v.longitude is not null
        and v.last_verified_at is not null
        and v.last_verified_at >= ${cutoff}
        and d.distance_km <= ${NEARBY_RADIUS_KM}
      order by d.distance_km asc
      limit 20
    `)
    const found = rowsOf<{
      id: string
      slug: string
      name: string
      kind: string
      address: string | null
      phone: string | null
      price_level: number | null
      avg_check: number | null
      last_verified_at: string | null
      latitude: number
      longitude: number
      description: string
      cuisine_tags: string[] | null
      region_id: string | null
      distance_km: number
    }>(result)
    const ids = found.map((row) => row.id)
    const sponsored = await this.sponsoredIds(ids)
    return found.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      address: row.address,
      phone: row.phone,
      priceLevel: row.price_level,
      avgCheck: row.avg_check,
      lastVerifiedAt: row.last_verified_at,
      latitude: row.latitude,
      longitude: row.longitude,
      description: row.description,
      cuisineTags: row.cuisine_tags ?? [],
      regionId: row.region_id,
      distanceKm: Number(row.distance_km),
      sponsored: sponsored.has(row.id),
    }))
  }

  static async sponsoredIds(ids: string[]) {
    if (!ids.length) {
      return new Set<string>()
    }
    const rows = await useDatabase().select({ venueId: offers.venueId }).from(offers).where(and(
      inArray(offers.venueId, ids),
      eq(offers.status, 'active'),
    ))
    return new Set(rows.map((row) => row.venueId).filter((id): id is string => Boolean(id)))
  }

  /** `createdDrafts` pairs each new row with the draft it came from. */
  static async importDrafts(drafts: OsmDraft[], regionId: string | null) {
    const created: string[] = []
    const createdDrafts: Array<{ id: string, draft: OsmDraft }> = []
    const existing: string[] = []
    const skipped: string[] = []
    for (const draft of drafts) {
      const prior = await this.byOsmId(draft.osmId)
      if (prior) {
        existing.push(prior.id)
        continue
      }
      try {
        const row = await this.create({
          name: draft.name,
          kind: draft.kind,
          cuisineTags: draft.cuisineTags,
          regionId,
          address: draft.address,
          latitude: draft.latitude,
          longitude: draft.longitude,
          phone: draft.phone,
          website: draft.website,
          contactEmail: draft.contactEmail,
          socials: draft.socials,
          menuUrl: draft.menuUrl,
          reservation: draft.reservation,
          takeaway: draft.takeaway,
          delivery: draft.delivery,
          hours: draft.hours,
          sources: draft.sources,
          osmId: draft.osmId,
          status: 'draft',
          description: '',
          locality: { town: draft.town, district: draft.district },
        })
        created.push(row.id)
        createdDrafts.push({ id: row.id, draft })
      } catch (error) {
        if (error instanceof VenueInputError) {
          const again = await this.byOsmId(draft.osmId)
          if (again) {
            existing.push(again.id)
            continue
          }
          skipped.push(draft.osmId)
          continue
        }
        throw error
      }
    }
    return { created, existing, skipped, createdDrafts }
  }

  static async gallery(venueId: string) {
    return useDatabase().select({
      linkId: venueMedia.id,
      sortOrder: venueMedia.sortOrder,
      isCover: venueMedia.isCover,
      origin: venueMedia.origin,
      media,
    }).from(venueMedia).innerJoin(media, eq(venueMedia.mediaId, media.id)).where(eq(venueMedia.venueId, venueId)).orderBy(asc(venueMedia.sortOrder))
  }

  static async coversFor(venueIds: string[]) {
    const unique = [...new Set(venueIds)]
    if (!unique.length) {
      return new Map<string, typeof media.$inferSelect>()
    }
    const links = await useDatabase().select().from(venueMedia).where(inArray(venueMedia.venueId, unique)).orderBy(asc(venueMedia.sortOrder))
    const coverLink = new Map<string, { mediaId: string, rank: number }>()
    for (const link of links) {
      const rank = link.isCover ? -1 : link.sortOrder
      const current = coverLink.get(link.venueId)
      if (!current || rank < current.rank) {
        coverLink.set(link.venueId, { mediaId: link.mediaId, rank })
      }
    }
    const ids = [...coverLink.values()].map((row) => row.mediaId)
    if (!ids.length) {
      return new Map<string, typeof media.$inferSelect>()
    }
    const rows = await useDatabase().select().from(media).where(inArray(media.id, ids))
    const byId = new Map(rows.map((row) => [row.id, row]))
    const result = new Map<string, typeof media.$inferSelect>()
    for (const [venueId, link] of coverLink) {
      const row = byId.get(link.mediaId)
      if (row) {
        result.set(venueId, row)
      }
    }
    return result
  }

  static async attachMedia(venueId: string, mediaId: string, options?: { isCover?: boolean, origin?: VenuePhotoOrigin | null, sortOrder?: number, promoteIfEmpty?: boolean }) {
    const db = useDatabase()
    const existing = await db.select().from(venueMedia).where(eq(venueMedia.venueId, venueId))
    const found = existing.find((row) => row.mediaId === mediaId)
    // A dish photo passes promoteIfEmpty: false so it does not become the cover.
    const cover = options?.promoteIfEmpty === false
      ? options?.isCover === true
      : options?.isCover === true || existing.length === 0
    if (cover) {
      await db.update(venueMedia).set({ isCover: false }).where(eq(venueMedia.venueId, venueId))
    }
    if (found) {
      const [updated] = await db.update(venueMedia).set({
        isCover: cover || found.isCover,
        sortOrder: options?.sortOrder ?? found.sortOrder,
        origin: options?.origin === undefined ? found.origin : options.origin,
      }).where(eq(venueMedia.id, found.id)).returning()
      return updated ?? found
    }
    const [created] = await db.insert(venueMedia).values({
      venueId,
      mediaId,
      sortOrder: options?.sortOrder ?? existing.length,
      isCover: cover,
      origin: options?.origin ?? null,
    }).returning()
    return created
  }

  static async listingIntro(regionId: string | null, kind: string | null) {
    const regionClause = regionId ? eq(venueListingIntros.regionId, regionId) : sql`${venueListingIntros.regionId} is null`
    const kindClause = kind ? eq(venueListingIntros.kind, kind) : sql`${venueListingIntros.kind} is null`
    const [row] = await useDatabase().select().from(venueListingIntros).where(and(regionClause, kindClause)).limit(1)
    return row ?? null
  }

  static async setListingIntro(input: {
    regionId: string | null
    kind: string | null
    body: string
    seoTitle?: string | null
    seoDescription?: string | null
  }) {
    if (input.kind && !isFoodKind(input.kind)) {
      assertKind(input.kind)
    }
    const current = await this.listingIntro(input.regionId, input.kind)
    const body = input.body.trim()
    if (current) {
      const [updated] = await useDatabase().update(venueListingIntros).set({
        body,
        seoTitle: input.seoTitle === undefined ? current.seoTitle : cleanText(input.seoTitle, 180),
        seoDescription: input.seoDescription === undefined ? current.seoDescription : cleanText(input.seoDescription, 300),
        updatedAt: new Date().toISOString(),
      }).where(eq(venueListingIntros.id, current.id)).returning()
      return updated ?? current
    }
    const [created] = await useDatabase().insert(venueListingIntros).values({
      regionId: input.regionId,
      kind: input.kind,
      body,
      seoTitle: cleanText(input.seoTitle, 180),
      seoDescription: cleanText(input.seoDescription, 300),
    }).returning()
    if (!created) {
      throw new VenueInputError('Не удалось сохранить вступление')
    }
    return created
  }

  /** Replaces modules on a listing. Creates the row with an empty intro when none exists. */
  static async setListingModules(input: { regionId: string | null, kind: string | null, modules: unknown[] }) {
    if (input.kind && !isFoodKind(input.kind)) {
      assertKind(input.kind)
    }
    const current = await this.listingIntro(input.regionId, input.kind)
    if (current) {
      const [updated] = await useDatabase().update(venueListingIntros).set({
        modules: input.modules,
        updatedAt: new Date().toISOString(),
      }).where(eq(venueListingIntros.id, current.id)).returning()
      return updated ?? current
    }
    const [created] = await useDatabase().insert(venueListingIntros).values({
      regionId: input.regionId,
      kind: input.kind,
      body: '',
      modules: input.modules,
    }).returning()
    if (!created) {
      throw new VenueInputError('Не удалось сохранить модули')
    }
    return created
  }

  static async listIntros() {
    return useDatabase().select().from(venueListingIntros)
  }

  /** Published and closed cards only. Drafts stay out of the cabinet search. */
  static async searchPublic(query: string, limit = 20) {
    const q = query.trim().toLowerCase().replace(/[%_\\]/g, '').slice(0, 60)
    if (q.length < 2) {
      return []
    }
    return useDatabase()
      .select({
        id: venues.id,
        slug: venues.slug,
        name: venues.name,
        address: venues.address,
        kind: venues.kind,
        status: venues.status,
      })
      .from(venues)
      .where(and(
        inArray(venues.status, ['published', 'closed']),
        sql`lower(${venues.name}) like ${`%${q}%`}`,
      ))
      .orderBy(asc(venues.name))
      .limit(limit)
  }

  static async revisions(venueId: string, limit = 30) {
    return useDatabase()
      .select()
      .from(revisions)
      .where(and(eq(revisions.entityType, 'venue'), eq(revisions.entityId, venueId)))
      .orderBy(desc(revisions.createdAt))
      .limit(limit)
  }

  /** Restore a previous snapshot. The current row is stored as a new revision first. */
  static async revertTo(venueId: string, revisionId: string, userId?: string | null) {
    const [revision] = await useDatabase().select().from(revisions).where(eq(revisions.id, revisionId)).limit(1)
    if (!revision || revision.entityType !== 'venue' || revision.entityId !== venueId) {
      return null
    }
    const snap = revision.snapshot
    if (!snap || typeof snap !== 'object') {
      return null
    }
    const row = snap as Record<string, unknown>
    return this.update(venueId, writeFromSnapshot(row), userId)
  }
}

const RESTORE_KEYS = [
  'slug', 'name', 'kind', 'cuisineTags', 'regionId', 'address', 'latitude', 'longitude',
  'priceLevel', 'avgCheck', 'hours', 'phone', 'website', 'socials', 'vkCommunityId', 'bookingUrl', 'orderUrl',
  'deliveryUrl', 'menuUrl', 'reservation', 'takeaway', 'delivery', 'signatureDishes',
  'modules', 'contactEmail', 'description', 'sources', 'status', 'lastVerifiedAt',
  'osmId', 'seoTitle', 'seoDescription', 'noindex',
] as const

function sameVenueWrite(current: object, next: Record<string, unknown>) {
  const row = current as Record<string, unknown>
  return Object.keys(next).every((key) => sameValue(row[key], next[key]))
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical)
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(record).sort()) {
      if (record[key] !== undefined) {
        out[key] = canonical(record[key])
      }
    }
    return out
  }
  return value
}

function writeFromSnapshot(row: Record<string, unknown>): VenueWrite {
  const write: Record<string, unknown> = {}
  for (const key of RESTORE_KEYS) {
    if (key in row) {
      write[key] = row[key]
    }
  }
  return write as VenueWrite
}

function likePattern(query: string) {
  const needle = query.trim().toLowerCase().replace(/ё/g, 'е').replace(/[\\%_]/g, '\\$&')
  return `%${needle}%`
}

function venueListWhere(filter: VenueListFilter) {
  const where = []
  if (filter.regionId) {
    where.push(eq(venues.regionId, filter.regionId))
  }
  if (filter.kind) {
    where.push(eq(venues.kind, filter.kind))
  }
  if (filter.status) {
    where.push(eq(venues.status, filter.status))
  }
  if (filter.foodOnly) {
    where.push(inArray(venues.kind, [...FOOD_KINDS]))
  }
  if (filter.stale === true) {
    where.push(sql`(${venues.lastVerifiedAt} is null or ${venues.lastVerifiedAt} < now() - (${STALE_DAYS} || ' days')::interval)`)
  }
  if (filter.stale === false) {
    where.push(sql`${venues.lastVerifiedAt} >= now() - (${STALE_DAYS} || ' days')::interval`)
  }
  const query = filter.query?.trim()
  if (query) {
    const pattern = likePattern(query)
    where.push(sql`(lower(translate(${venues.name}, 'ёЁ', 'еЕ')) like ${pattern} or lower(${venues.slug}) like ${pattern})`)
  }
  return where
}
