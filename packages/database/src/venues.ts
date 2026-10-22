import type { SourceLink } from './types/entities'
import { ownWebsiteProblem } from '@k39/types/official-url'
import { isSocialHost } from '@k39/types/social-hosts'
import { PHONE_TEXT_MAX } from './phone'

export const FOOD_KINDS = ['cafe', 'restaurant', 'coffee', 'bar', 'bakery', 'market', 'fastfood', 'other'] as const

export type FoodKind = (typeof FOOD_KINDS)[number]

export type VenueStatus = 'draft' | 'published' | 'closed' | 'archived'

export const VENUE_STATUSES: VenueStatus[] = ['draft', 'published', 'closed', 'archived']

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export type Weekday = (typeof WEEKDAYS)[number]

export const STALE_DAYS = 180

export const NEARBY_MAX_DAYS = 365

export const NEARBY_RADIUS_KM = 5

export const NEARBY_LIMIT = 5

export const DESCRIPTION_MIN = 300

export const DESCRIPTION_MAX = 600

export const LISTING_INTRO_MIN = 300

export const KIND_PATH: Record<FoodKind, string> = {
  cafe: 'kafe',
  restaurant: 'restoran',
  coffee: 'kofe',
  bar: 'bar',
  bakery: 'pekarnya',
  market: 'rynok',
  fastfood: 'fastfud',
  other: 'drugoe',
}

export const KIND_LABEL: Record<FoodKind, string> = {
  cafe: 'кафе',
  restaurant: 'ресторан',
  coffee: 'кофейня',
  bar: 'бар',
  bakery: 'пекарня',
  market: 'рынок',
  fastfood: 'фастфуд',
  other: 'другое',
}

export const KIND_HEADING: Record<FoodKind, string> = {
  cafe: 'Кафе',
  restaurant: 'Рестораны',
  coffee: 'Кофейни',
  bar: 'Бары',
  bakery: 'Пекарни',
  market: 'Рынки',
  fastfood: 'Фастфуд',
  other: 'Другие заведения',
}

const PATH_KIND = new Map<string, FoodKind>(FOOD_KINDS.map((kind) => [KIND_PATH[kind], kind]))

const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: 'пн',
  tue: 'вт',
  wed: 'ср',
  thu: 'чт',
  fri: 'пт',
  sat: 'сб',
  sun: 'вс',
}

const OSM_DAY: Record<string, Weekday> = {
  Mo: 'mon',
  Tu: 'tue',
  We: 'wed',
  Th: 'thu',
  Fr: 'fri',
  Sa: 'sat',
  Su: 'sun',
}

const RU: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

export interface VenueDayHours {
  weekday: Weekday
  closed: boolean
  /** The source gives no hours for this day: neither open nor closed (ADR 0044). */
  unknown?: boolean
  opens: string | null
  closes: string | null
}

export interface VenueHours {
  days: VenueDayHours[]
  note: string | null
}

export const VENUE_RESERVATIONS = ['yes', 'no', 'required', 'recommended'] as const

export type VenueReservation = (typeof VENUE_RESERVATIONS)[number]

/** Who supplied a venue photo. Never a copy from another site. */
export const VENUE_PHOTO_ORIGINS = ['own', 'venue', 'commons'] as const

export type VenuePhotoOrigin = (typeof VENUE_PHOTO_ORIGINS)[number]

export interface VenueDish {
  name: string
  note?: string | null
  priceRub?: number | null
}

export const SIGNATURE_DISHES_MAX = 5

export interface VenueSocial {
  network: string
  url: string
}

export interface NearbyCandidate {
  id: string
  distanceKm: number
  sponsored: boolean
}

export interface OsmElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat?: number, lon?: number }
  tags?: Record<string, string>
}

export interface OsmDraft {
  osmId: string
  name: string
  slug: string
  kind: string
  cuisineTags: string[]
  latitude: number
  longitude: number
  address: string | null
  town: string | null
  district: string | null
  phone: string | null
  website: string | null
  contactEmail: string | null
  socials: VenueSocial[]
  menuUrl: string | null
  reservation: VenueReservation | null
  takeaway: boolean | null
  delivery: boolean | null
  hours: VenueHours
  sources: SourceLink[]
}

export class VenueInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VenueInputError'
  }
}

export function isFoodKind(kind: string): kind is FoodKind {
  return (FOOD_KINDS as readonly string[]).includes(kind)
}

export function kindFromPath(segment: string): FoodKind | null {
  return PATH_KIND.get(segment) ?? null
}

export function kindPath(kind: string) {
  return isFoodKind(kind) ? KIND_PATH[kind] : kind
}

export function kindLabel(kind: string) {
  return isFoodKind(kind) ? KIND_LABEL[kind] : kind
}

/**
 * Kind words stripped from a duplicate-name comparison. «Другое» stays:
 * it is a catalog bucket, not a word in a venue name.
 */
const VENUE_NAME_KIND_WORDS = new Set<string>([
  'кафе',
  'ресторан',
  'ресторана',
  'ресторане',
  'кофейня',
  'кофейни',
  'кофейне',
  'бар',
  'бара',
  'баре',
  'пекарня',
  'пекарни',
  'пекарне',
  'рынок',
  'рынка',
  'рынке',
  'фастфуд',
  'cafe',
  'restaurant',
  'coffee',
  'bar',
  'bakery',
  'market',
  'fastfood',
])

/**
 * Comparison key for a venue name: lower case, ё folded to е, quotes and
 * other punctuation removed, and a leading kind word such as «кафе» dropped.
 * An empty key (the name was only a kind word) matches nothing.
 */
export function venueNameKey(name: string) {
  const tokens = name
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token && !VENUE_NAME_KIND_WORDS.has(token))
  return tokens.join(' ')
}

export function kindHeading(kind: string) {
  return isFoodKind(kind) ? KIND_HEADING[kind] : kind
}

export function venueSchemaType(kind: string) {
  if (kind === 'market' || kind === 'other' || !isFoodKind(kind)) {
    return 'LocalBusiness'
  }
  return 'Restaurant'
}

export function transliterateVenueSlug(value: string) {
  const lowered = value.trim().toLowerCase()
  const mapped = lowered.split('').map((char) => RU[char] ?? char).join('')
  return mapped.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function assertKind(kind: string) {
  if (!/^[a-z][a-z0-9_]{0,31}$/.test(kind)) {
    throw new VenueInputError('Тип заведения: латиница, с маленькой буквы')
  }
}

export function isBlockedVenueSlug(slug: string, reserved: ReadonlySet<string>) {
  return reserved.has(slug) || PATH_KIND.has(slug)
}

export function assertVenueSlug(slug: string, reserved: ReadonlySet<string>) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new VenueInputError('Адрес: только латиница, цифры и дефисы')
  }
  if (isBlockedVenueSlug(slug, reserved)) {
    throw new VenueInputError('Этот адрес занят разделом или регионом')
  }
}

export interface VenueLocality {
  town?: string | null
  district?: string | null
}

const SLUG_CANDIDATE_LIMIT = 30

export function venueSlugCandidates(base: string, locality?: VenueLocality | null, limit = SLUG_CANDIDATE_LIMIT) {
  const root = transliterateVenueSlug(base)
  if (!root) {
    return []
  }
  const suffixes = [locality?.town, locality?.district]
    .map((part) => (part ? transliterateVenueSlug(part) : ''))
    .filter((suffix, index, all) => suffix.length > 0 && suffix !== root && !root.endsWith(`-${suffix}`) && all.indexOf(suffix) === index)
  const stems = [root, ...suffixes.map((suffix) => `${root}-${suffix}`)]
  const candidates: string[] = []
  const push = (slug: string) => {
    if (candidates.length >= limit || candidates.includes(slug)) {
      return
    }
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      candidates.push(slug)
    }
  }
  for (const stem of stems) {
    push(stem)
  }
  const numbered = stems[stems.length - 1] || root
  for (let n = 2; candidates.length < limit; n += 1) {
    push(`${numbered}-${n}`)
  }
  return candidates
}

export function pickVenueSlug(base: string, taken: ReadonlySet<string>, reserved: ReadonlySet<string>, locality?: VenueLocality | null) {
  for (const candidate of venueSlugCandidates(base, locality)) {
    if (taken.has(candidate) || isBlockedVenueSlug(candidate, reserved)) {
      continue
    }
    return candidate
  }
  return null
}

export function descriptionLength(value: string) {
  return value.trim().length
}

export function descriptionPublishError(value: string) {
  const length = descriptionLength(value)
  if (length < DESCRIPTION_MIN || length > DESCRIPTION_MAX) {
    return `Описание для публикации: ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} знаков, сейчас ${length}`
  }
  return null
}

export function emptyHours(note: string | null = null): VenueHours {
  return {
    days: WEEKDAYS.map((weekday) => ({ weekday, closed: true, opens: null, closes: null })),
    note,
  }
}

const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export function normalizeHours(value: unknown): VenueHours {
  const raw = value && typeof value === 'object' ? value as { days?: unknown, note?: unknown } : {}
  const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, 300) || null : null
  const given = new Map<Weekday, VenueDayHours>()
  if (Array.isArray(raw.days)) {
    for (const item of raw.days) {
      if (!item || typeof item !== 'object') {
        continue
      }
      const day = item as { weekday?: unknown, closed?: unknown, unknown?: unknown, opens?: unknown, closes?: unknown }
      if (typeof day.weekday !== 'string' || !(WEEKDAYS as readonly string[]).includes(day.weekday)) {
        continue
      }
      const weekday = day.weekday as Weekday
      if (day.unknown === true && day.closed !== true) {
        given.set(weekday, { weekday, closed: false, unknown: true, opens: null, closes: null })
        continue
      }
      const closed = day.closed === true
      const opens = typeof day.opens === 'string' && CLOCK.test(day.opens) ? day.opens : null
      const closes = typeof day.closes === 'string' && (CLOCK.test(day.closes) || day.closes === '24:00') ? day.closes : null
      // An opening time without a closing time is an open-ended day (ADR 0042).
      if (!closed && !opens) {
        throw new VenueInputError(`Часы ${weekday}: нужно opens, либо closed`)
      }
      given.set(weekday, { weekday, closed: closed || !opens, opens: closed ? null : opens, closes: closed ? null : closes })
    }
  }
  return {
    days: WEEKDAYS.map((weekday) => given.get(weekday) ?? { weekday, closed: true, opens: null, closes: null }),
    note,
  }
}

export const HOURS_UNKNOWN = 'Часы уточняйте'

function dayKey(day: VenueDayHours) {
  return day.unknown ? 'unknown' : day.closed ? 'closed' : `${day.opens}-${day.closes}`
}

export function formatHoursLines(hours: VenueHours) {
  const open = hours.days.some((day) => !day.closed && day.opens)
  if (!open) {
    const note = hours.note?.trim()
    return [note || HOURS_UNKNOWN]
  }
  const lines: string[] = []
  let index = 0
  while (index < hours.days.length) {
    const day = hours.days[index]!
    const key = dayKey(day)
    let end = index
    while (end + 1 < hours.days.length) {
      const next = hours.days[end + 1]!
      const nextKey = dayKey(next)
      if (nextKey !== key) {
        break
      }
      end += 1
    }
    const label = index === end
      ? WEEKDAY_LABEL[day.weekday]
      : `${WEEKDAY_LABEL[day.weekday]}-${WEEKDAY_LABEL[hours.days[end]!.weekday]}`
    lines.push(day.unknown ? `${label}: часы уточняйте` : day.closed ? `${label} выходной` : day.closes ? `${label} ${day.opens}-${day.closes}` : `${label} с ${day.opens}, закрытие уточняйте`)
    index = end + 1
  }
  if (hours.note?.trim()) {
    lines.push(hours.note.trim())
  }
  return lines
}

export function verifiedAgeDays(value: string | null | undefined, now: Date) {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000)
}

export function isStale(value: string | null | undefined, now: Date) {
  const age = verifiedAgeDays(value, now)
  return age == null || age > STALE_DAYS
}

export function nearbyFresh(value: string | null | undefined, now: Date) {
  const age = verifiedAgeDays(value, now)
  return age != null && age <= NEARBY_MAX_DAYS
}

export function formatVenueDistance(km: number) {
  if (!Number.isFinite(km) || km < 0) {
    return ''
  }
  if (km < 1) {
    const meters = Math.max(10, Math.round((km * 1000) / 10) * 10)
    return `${meters} м`
  }
  if (km < 10) {
    const rounded = Math.round(km * 10) / 10
    return `${rounded.toFixed(1).replace('.', ',')} км`
  }
  return `${Math.round(km)} км`
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (value: number) => value * Math.PI / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function rankNearby<T extends NearbyCandidate>(rows: T[], options: { sponsoredSlot: boolean, limit?: number }) {
  const limit = options.limit ?? NEARBY_LIMIT
  const byDistance = [...rows].sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id))
  const sponsor = options.sponsoredSlot ? byDistance.find((row) => row.sponsored) : undefined
  const ordered = sponsor
    ? [sponsor, ...byDistance.filter((row) => row.id !== sponsor.id)]
    : byDistance
  return ordered.slice(0, limit).map((row) => ({
    ...row,
    partner: Boolean(sponsor && row.id === sponsor.id),
  }))
}

export function listingPath(regionSlug?: string | null, kind?: string | null) {
  const parts = ['/zavedeniya']
  if (regionSlug) {
    parts.push(regionSlug)
  }
  if (kind) {
    parts.push(kindPath(kind))
  }
  return parts.join('/')
}

export type VenuePath
  = | { type: 'listing', regionSlug: string | null, kind: string | null }
    | { type: 'venue', slug: string }

export function resolveVenuePath(segments: string[], regionSlugs: ReadonlySet<string>): VenuePath | null {
  if (segments.length === 0) {
    return { type: 'listing', regionSlug: null, kind: null }
  }
  if (segments.length === 1) {
    const [segment] = segments
    if (!segment) {
      return null
    }
    if (regionSlugs.has(segment)) {
      return { type: 'listing', regionSlug: segment, kind: null }
    }
    const kind = kindFromPath(segment)
    if (kind) {
      return { type: 'listing', regionSlug: null, kind }
    }
    return { type: 'venue', slug: segment }
  }
  if (segments.length === 2) {
    const [region, kindSegment] = segments
    const kind = kindSegment ? kindFromPath(kindSegment) : null
    if (!region || !regionSlugs.has(region) || !kind) {
      return null
    }
    return { type: 'listing', regionSlug: region, kind }
  }
  return null
}

function weekdaySpan(start: string, end: string) {
  const from = OSM_DAY[start]
  const to = OSM_DAY[end]
  if (!from || !to) {
    return null
  }
  const startIndex = WEEKDAYS.indexOf(from)
  const endIndex = WEEKDAYS.indexOf(to)
  if (startIndex < 0 || endIndex < startIndex) {
    return null
  }
  return WEEKDAYS.slice(startIndex, endIndex + 1)
}

function applyHoursRule(hours: VenueHours, days: Weekday[], opens: string, closes: string) {
  for (const weekday of days) {
    const current = hours.days.find((day) => day.weekday === weekday)
    if (!current || !current.closed) {
      continue
    }
    current.closed = false
    current.opens = opens
    current.closes = closes
  }
}

export function parseOsmHours(raw: string | undefined): VenueHours {
  const text = raw?.trim() || ''
  if (!text) {
    return emptyHours()
  }
  if (text === '24/7') {
    const hours = emptyHours()
    for (const day of hours.days) {
      day.closed = false
      day.opens = '00:00'
      day.closes = '24:00'
    }
    return hours
  }
  const hours = emptyHours()
  const rules = text.split(';').map((part) => part.trim()).filter(Boolean)
  let parsed = 0
  for (const rule of rules) {
    const match = /^([A-Z][a-z])(?:-([A-Z][a-z]))?\s+(\d{2}:\d{2})-(\d{2}:\d{2})/.exec(rule)
    if (!match) {
      continue
    }
    const days = weekdaySpan(match[1] || '', match[2] || match[1] || '')
    const opens = match[3] || ''
    const closes = match[4] || ''
    if (!days || !CLOCK.test(opens) || !(CLOCK.test(closes) || closes === '24:00')) {
      continue
    }
    applyHoursRule(hours, days, opens, closes)
    parsed += 1
  }
  if (!parsed) {
    return emptyHours(text.slice(0, 300))
  }
  if (parsed < rules.length) {
    hours.note = text.slice(0, 300)
  }
  return hours
}

function osmLocality(tags: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = tags[key]?.trim()
    if (value) {
      return value.slice(0, 80)
    }
  }
  return null
}

function cuisineTags(raw: string | undefined) {
  return [...new Set((raw || '').split(/[;,]/).map((item) => item.trim().toLowerCase()).filter(Boolean))].slice(0, 12)
}

export function osmKind(tags: Record<string, string>) {
  if (tags.shop === 'bakery') {
    return { kind: 'bakery', cuisine: cuisineTags(tags.cuisine) }
  }
  const amenity = tags.amenity || ''
  const cuisine = cuisineTags(tags.cuisine)
  if (amenity === 'fast_food') {
    return { kind: 'fastfood', cuisine }
  }
  if (amenity === 'bar' || amenity === 'pub') {
    return { kind: 'bar', cuisine }
  }
  if (amenity === 'restaurant') {
    return { kind: 'restaurant', cuisine }
  }
  if (amenity === 'ice_cream') {
    return { kind: 'other', cuisine: cuisine.includes('ice_cream') ? cuisine : ['ice_cream', ...cuisine].slice(0, 12) }
  }
  if (amenity === 'cafe') {
    return { kind: cuisine.includes('coffee') ? 'coffee' : 'cafe', cuisine }
  }
  return null
}

/** Official venue mailbox from OSM. Anything that is not a single address is dropped. */
export function osmEmail(value: string | undefined) {
  const text = (value || '').trim().toLowerCase().slice(0, 120)
  if (!/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(text)) {
    return null
  }
  return text
}

export function osmElementToDraft(element: OsmElement): OsmDraft | null {
  if (element.type !== 'node' && element.type !== 'way' && element.type !== 'relation') {
    return null
  }
  const tags = element.tags || {}
  const mapped = osmKind(tags)
  const name = (tags['name:ru'] || tags.name || '').trim()
  const latitude = element.lat ?? element.center?.lat
  const longitude = element.lon ?? element.center?.lon
  if (!mapped || !name || latitude == null || longitude == null) {
    return null
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null
  }
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', ')
  const town = osmLocality(tags, ['addr:city', 'addr:town', 'addr:place'])
  const district = osmLocality(tags, ['addr:suburb', 'addr:district', 'addr:neighbourhood', 'addr:quarter'])
  const address = [town, street].filter(Boolean).join(', ') || null
  const slug = transliterateVenueSlug(name)
  if (!slug) {
    return null
  }
  return {
    osmId: `${element.type}/${element.id}`,
    name: name.slice(0, 160),
    slug,
    kind: mapped.kind,
    cuisineTags: mapped.cuisine,
    latitude,
    longitude,
    address: address ? address.slice(0, 300) : null,
    town,
    district,
    phone: (tags.phone || tags['contact:phone'] || '').trim().slice(0, PHONE_TEXT_MAX) || null,
    ...ownSiteAndSocials((tags.website || tags['contact:website'] || '').trim().slice(0, 300) || null, osmSocials(tags)),
    contactEmail: osmEmail(tags.email || tags['contact:email']),
    menuUrl: osmUrl(tags['website:menu'] || tags['contact:menu'] || tags.menu),
    reservation: osmReservation(tags.reservation),
    takeaway: osmYesNo(tags.takeaway),
    delivery: osmYesNo(tags.delivery),
    hours: parseOsmHours(tags.opening_hours),
    sources: [{ title: 'OpenStreetMap', url: `https://www.openstreetmap.org/${element.type}/${element.id}` }],
  }
}

const AMENITY = 'cafe|restaurant|bar|fast_food|pub|ice_cream'

export const OVERPASS_QUERY_TIMEOUT_SECONDS = 90

export function overpassQuery(input: { latitude: number, longitude: number, radiusMeters: number } | { south: number, west: number, north: number, east: number }, timeoutSeconds = OVERPASS_QUERY_TIMEOUT_SECONDS) {
  const clause = 'latitude' in input
    ? `(around:${Math.round(input.radiusMeters)},${input.latitude},${input.longitude})`
    : `(${input.south},${input.west},${input.north},${input.east})`
  const timeout = Number.isFinite(timeoutSeconds) && timeoutSeconds > 0 ? Math.round(timeoutSeconds) : OVERPASS_QUERY_TIMEOUT_SECONDS
  return `[out:json][timeout:${timeout}];(node["amenity"~"^(${AMENITY})$"]${clause};way["amenity"~"^(${AMENITY})$"]${clause};node["shop"="bakery"]${clause};way["shop"="bakery"]${clause};);out center tags;`
}

export function assertOverpassArea(input: { latitude: number, longitude: number, radiusMeters: number } | { south: number, west: number, north: number, east: number }) {
  if ('latitude' in input) {
    if (input.latitude < -90 || input.latitude > 90 || input.longitude < -180 || input.longitude > 180) {
      throw new VenueInputError('Координаты вне диапазона')
    }
    if (input.radiusMeters < 50 || input.radiusMeters > 20_000) {
      throw new VenueInputError('Радиус: от 50 до 20000 метров')
    }
    return
  }
  if (input.south >= input.north || input.west >= input.east) {
    throw new VenueInputError('bbox: south < north и west < east')
  }
  if (input.north - input.south > 0.5 || input.east - input.west > 0.5) {
    throw new VenueInputError('bbox слишком большой')
  }
}

// Straight-line distance times a street detour factor, at an unhurried 4.5 km/h.
// No routing engine: this is an estimate and the UI says «~».
export const WALK_DETOUR = 1.3
export const WALK_KMH = 4.5
export const WALK_MAX_MINUTES = 30

export function walkMinutes(km: number) {
  if (!Number.isFinite(km) || km < 0) {
    return null
  }
  return Math.max(1, Math.round((km * WALK_DETOUR / WALK_KMH) * 60))
}

/** «~6 мин пешком», or '' when it is too far to call a walk. */
export function formatWalk(km: number) {
  const minutes = walkMinutes(km)
  return minutes != null && minutes <= WALK_MAX_MINUTES ? `~${minutes} мин пешком` : ''
}

const CUISINE_LABEL: Record<string, string> = {
  american: 'американская', arab: 'арабская', armenian: 'армянская', asian: 'азиатская',
  baltic: 'балтийская', barbecue: 'барбекю', bavarian: 'баварская', breakfast: 'завтраки',
  burger: 'бургеры', cake: 'десерты', caucasian: 'кавказская', chicken: 'курица',
  chinese: 'китайская', coffee: 'кофе', coffee_shop: 'кофе', crepe: 'блины', czech: 'чешская',
  european: 'европейская', fish: 'рыба', fish_and_chips: 'фиш-энд-чипс', french: 'французская',
  georgian: 'грузинская', german: 'немецкая', greek: 'греческая', grill: 'гриль',
  home: 'домашняя', ice_cream: 'мороженое', international: 'интернациональная',
  italian: 'итальянская', italian_pizza: 'пицца', japanese: 'японская', kebab: 'шаурма',
  korean: 'корейская', lithuanian: 'литовская', local: 'местная', mediterranean: 'средиземноморская',
  mexican: 'мексиканская', pasta: 'паста', pie: 'пироги', pies: 'пироги', pizza: 'пицца',
  prussian: 'прусская', pub: 'паб', regional: 'местная', russian: 'русская', seafood: 'морепродукты',
  steak: 'стейки', steak_house: 'стейки', sushi: 'суши', tea: 'чай', turkish: 'турецкая',
  ukrainian: 'украинская', uzbek: 'узбекская',
}

/** Russian cuisine labels in stored order, unknown tokens dropped, duplicates merged. */
export function cuisineLabels(tags: string[] | null | undefined, limit = 2) {
  const labels: string[] = []
  for (const tag of tags ?? []) {
    const label = CUISINE_LABEL[tag.trim().toLowerCase()]
    if (label && !labels.includes(label)) {
      labels.push(label)
    }
  }
  return labels.slice(0, limit)
}

export function priceMarks(level: number | null) {
  if (level == null || level < 1) {
    return ''
  }
  return '₽'.repeat(Math.min(4, level))
}

export function formatAvgCheck(rubles: number | null) {
  if (rubles == null) {
    return ''
  }
  return `средний чек ${new Intl.NumberFormat('ru-RU').format(rubles)} ₽`
}

export const STALE_NOTE = 'Сведения не проверялись больше 180 дней. Уточните часы перед визитом.'

export const STALE_CARD_NOTE = 'Давно не проверяли'

export const CLOSED_NOTE = 'Заведение закрыто.'

const OSM_SOCIAL: Record<string, string> = {
  'contact:vk': 'vk',
  'contact:telegram': 'telegram',
  'contact:instagram': 'instagram',
  'contact:facebook': 'facebook',
  'contact:whatsapp': 'whatsapp',
  'contact:youtube': 'youtube',
  'contact:ok': 'ok',
}

const SOCIAL_BASE: Record<string, string> = {
  vk: 'https://vk.com/',
  telegram: 'https://t.me/',
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
  youtube: 'https://youtube.com/',
  ok: 'https://ok.ru/',
}

function websiteHost(value: string) {
  const text = value.trim()
  if (!text) {
    return ''
  }
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`
  try {
    return new URL(withScheme).hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** True when the value points at a social network rather than the venue's own site. */
export function isSocialWebsite(value: string | null | undefined) {
  return isSocialHost(websiteHost(value ?? ''))
}

function socialNetworkOfWebsite(value: string) {
  const host = websiteHost(value)
  if (/(?:^|\.)vk\.(?:com|ru)$/.test(host)) {
    return 'vk'
  }
  if (/(?:^|\.)(?:t\.me|telegram\.(?:me|org))$/.test(host)) {
    return 'telegram'
  }
  if (/(?:^|\.)instagram\.com$/.test(host)) {
    return 'instagram'
  }
  if (/(?:^|\.)ok\.ru$/.test(host)) {
    return 'ok'
  }
  if (/(?:^|\.)(?:facebook\.com|fb\.(?:com|me))$/.test(host)) {
    return 'facebook'
  }
  if (/(?:^|\.)(?:youtube\.com|youtu\.be)$/.test(host)) {
    return 'youtube'
  }
  if (/(?:^|\.)(?:whatsapp\.com|wa\.me)$/.test(host)) {
    return 'whatsapp'
  }
  if (/(?:^|\.)tiktok\.com$/.test(host)) {
    return 'tiktok'
  }
  if (/(?:^|\.)dzen\.ru$/.test(host)) {
    return 'dzen'
  }
  if (/(?:^|\.)threads\.net$/.test(host)) {
    return 'threads'
  }
  if (/(?:^|\.)(?:x\.com|twitter\.com)$/.test(host)) {
    return 'x'
  }
  return 'social'
}

/**
 * A social URL in the OSM website tag is a social, not the venue site. A tag
 * without a scheme gains `https://`. A map, a listing, or another value that
 * fails the «Сайт» rule is dropped, so the draft write does not reject it.
 */
function ownSiteAndSocials(website: string | null, socials: VenueSocial[]) {
  if (!website) {
    return { website, socials }
  }
  if (!isSocialWebsite(website)) {
    const url = /^https?:\/\//i.test(website) ? website : `https://${website}`
    return { website: ownWebsiteProblem(url) ? null : url.slice(0, 300), socials }
  }
  const url = website
  if (socials.some((row) => row.url === url)) {
    return { website: null, socials }
  }
  return { website: null, socials: [...socials, { network: socialNetworkOfWebsite(url), url }] }
}

function osmUrl(raw: string | undefined) {
  const value = (raw ?? '').split(';')[0]?.trim() ?? ''
  return /^https?:\/\//i.test(value) ? value.slice(0, 300) : null
}

/** contact:* tags as links. A bare handle becomes the network URL; WhatsApp numbers become wa.me. */
export function osmSocials(tags: Record<string, string>) {
  const rows: VenueSocial[] = []
  for (const [key, network] of Object.entries(OSM_SOCIAL)) {
    const raw = tags[key]?.split(';')[0]?.trim()
    if (!raw) {
      continue
    }
    let url = osmUrl(raw)
    if (!url && network === 'whatsapp') {
      const digits = raw.replace(/\D/g, '')
      url = digits.length >= 10 ? `https://wa.me/${digits}` : null
    } else if (!url && SOCIAL_BASE[network] && /^@?[\w.]{2,64}$/.test(raw)) {
      url = `${SOCIAL_BASE[network]}${raw.replace(/^@/, '')}`
    }
    if (url) {
      rows.push({ network, url })
    }
  }
  return rows
}

export function osmYesNo(raw: string | undefined) {
  const value = raw?.trim().toLowerCase()
  if (value === 'yes' || value === 'only') {
    return true
  }
  return value === 'no' ? false : null
}

export function osmReservation(raw: string | undefined): VenueReservation | null {
  const value = raw?.trim().toLowerCase()
  return (VENUE_RESERVATIONS as readonly string[]).includes(value ?? '') ? value as VenueReservation : null
}
