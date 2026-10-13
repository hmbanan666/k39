import type { VenueHours, VenueInterval, VenueKind, VenueSocials } from '@k39/database'

export type { VenueHours, VenueInterval, VenueKind, VenueSocials }

export const VENUE_DESCRIPTION_MIN = 300
export const VENUE_DESCRIPTION_MAX = 600
export const VENUE_STALE_DAYS = 180
export const VENUE_NEARBY_MAX_DAYS = 365
export const VENUE_NEARBY_RADIUS_KM = 2
export const VENUE_NEARBY_LIMIT = 5
export const VENUE_IMPRESSION_PREFIX = 'venue:'

export const VENUE_KINDS = [
  { kind: 'cafe', slug: 'kafe', label: 'Кафе', plural: 'Кафе', schema: 'Restaurant' },
  { kind: 'restaurant', slug: 'restoran', label: 'Ресторан', plural: 'Рестораны', schema: 'Restaurant' },
  { kind: 'coffee', slug: 'kofe', label: 'Кофейня', plural: 'Кофейни', schema: 'Restaurant' },
  { kind: 'bar', slug: 'bar', label: 'Бар', plural: 'Бары', schema: 'Restaurant' },
  { kind: 'bakery', slug: 'pekarnya', label: 'Пекарня', plural: 'Пекарни', schema: 'Restaurant' },
  { kind: 'market', slug: 'rynok', label: 'Рынок', plural: 'Рынки', schema: 'LocalBusiness' },
  { kind: 'fastfood', slug: 'fastfud', label: 'Фастфуд', plural: 'Фастфуд', schema: 'Restaurant' },
  { kind: 'other', slug: 'drugoe', label: 'Другое', plural: 'Другие заведения', schema: 'LocalBusiness' },
] as const

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type VenueWeekday = typeof WEEKDAYS[number]

const WEEKDAY_LABEL: Record<VenueWeekday, string> = {
  mon: 'пн',
  tue: 'вт',
  wed: 'ср',
  thu: 'чт',
  fri: 'пт',
  sat: 'сб',
  sun: 'вс',
}

const OSM_DAY: Record<string, VenueWeekday> = {
  mo: 'mon',
  tu: 'tue',
  we: 'wed',
  th: 'thu',
  fr: 'fri',
  sa: 'sat',
  su: 'sun',
}

const SCHEMA_DAY: Record<VenueWeekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

export function venueKindMeta(kind: string) {
  return VENUE_KINDS.find((item) => item.kind === kind) ?? VENUE_KINDS[VENUE_KINDS.length - 1]!
}

export function venueKindBySlug(slug: string) {
  return VENUE_KINDS.find((item) => item.slug === slug) ?? null
}

export function venueSchemaType(kind: string) {
  return venueKindMeta(kind).schema
}

export function venueAgeDays(lastVerifiedAt: string | null | undefined, now = new Date()) {
  if (!lastVerifiedAt) {
    return null
  }
  const date = new Date(lastVerifiedAt)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000)
}

export function venueIsStale(lastVerifiedAt: string | null | undefined, now = new Date()) {
  const age = venueAgeDays(lastVerifiedAt, now)
  return age == null || age > VENUE_STALE_DAYS
}

export function venueNearbyEligible(lastVerifiedAt: string | null | undefined, now = new Date()) {
  const age = venueAgeDays(lastVerifiedAt, now)
  return age != null && age <= VENUE_NEARBY_MAX_DAYS
}

export function formatWalkingDistance(km: number) {
  if (!Number.isFinite(km) || km < 0) {
    return ''
  }
  const meters = km * 1000
  if (meters < 1000) {
    const rounded = Math.max(10, Math.round(meters / 10) * 10)
    return `${rounded} м`
  }
  const rounded = Math.round(km * 10) / 10
  const text = rounded.toFixed(1).replace('.', ',').replace(',0', '')
  return `${text} км`
}

export function formatPriceLevel(level: number | null | undefined) {
  if (!level || level < 1) {
    return ''
  }
  return '₽'.repeat(Math.min(4, level))
}

export function formatAvgCheck(value: number | null | undefined) {
  if (value == null) {
    return ''
  }
  return `средний чек ${value.toLocaleString('ru-RU')} ₽`
}

export function hoursHaveIntervals(hours: VenueHours | null | undefined) {
  if (!hours) {
    return false
  }
  return WEEKDAYS.some((day) => Array.isArray(hours[day]) && (hours[day]?.length ?? 0) > 0)
}

function intervalKey(day: VenueHours[VenueWeekday]) {
  if (!Array.isArray(day) || !day.length) {
    return day === undefined ? '' : 'closed'
  }
  return day.map((item) => `${item.open}-${item.close}`).join(',')
}

export function formatVenueHours(hours: VenueHours | null | undefined) {
  const lines: string[] = []
  if (hours) {
    let index = 0
    while (index < WEEKDAYS.length) {
      const day = WEEKDAYS[index]!
      const key = intervalKey(hours[day])
      if (!key) {
        index += 1
        continue
      }
      let end = index
      while (end + 1 < WEEKDAYS.length && intervalKey(hours[WEEKDAYS[end + 1]!]) === key) {
        end += 1
      }
      const label = index === end
        ? WEEKDAY_LABEL[day]
        : `${WEEKDAY_LABEL[day]}-${WEEKDAY_LABEL[WEEKDAYS[end]!]}`
      lines.push(key === 'closed' ? `${label}: выходной` : `${label}: ${key.replace(',', ', ')}`)
      index = end + 1
    }
  }
  const note = hours?.note?.trim()
  if (note) {
    lines.push(note)
  }
  return lines
}

export function openingHoursSpec(hours: VenueHours | null | undefined) {
  const specs: Array<Record<string, string>> = []
  if (!hours) {
    return specs
  }
  for (const day of WEEKDAYS) {
    const intervals = hours[day]
    if (!Array.isArray(intervals)) {
      continue
    }
    for (const interval of intervals) {
      specs.push({
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': SCHEMA_DAY[day],
        'opens': interval.open,
        'closes': interval.close,
      })
    }
  }
  return specs
}

export interface RankableVenue {
  distanceKm: number
  sponsored: boolean
}

// Sponsored slot: with the flag on, the closest venue that has an active offer
// takes the first place and is labeled later. The flag defaults off.
export function rankNearbyVenues<T extends RankableVenue>(rows: T[], sponsorRank: boolean, limit = VENUE_NEARBY_LIMIT) {
  const byDistance = [...rows].sort((a, b) => a.distanceKm - b.distanceKm || 0)
  if (!sponsorRank) {
    return byDistance.slice(0, limit).map((row) => ({ ...row, partner: false }))
  }
  const sponsor = byDistance.find((row) => row.sponsored)
  if (!sponsor) {
    return byDistance.slice(0, limit).map((row) => ({ ...row, partner: false }))
  }
  const rest = byDistance.filter((row) => row !== sponsor)
  return [
    { ...sponsor, partner: true },
    ...rest.slice(0, Math.max(0, limit - 1)).map((row) => ({ ...row, partner: false })),
  ]
}

export function descriptionMissing(description: string | null | undefined) {
  return !description?.trim()
}

export function descriptionLengthError(description: string, status: string) {
  const length = description.trim().length
  if (length > VENUE_DESCRIPTION_MAX) {
    return `Описание длиннее ${VENUE_DESCRIPTION_MAX} знаков.`
  }
  if (status === 'published' && length < VENUE_DESCRIPTION_MIN) {
    return `Для публикации нужно описание от ${VENUE_DESCRIPTION_MIN} до ${VENUE_DESCRIPTION_MAX} знаков.`
  }
  return null
}

export interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat?: number, lon?: number }
  tags?: Record<string, string>
}

export interface OsmVenueDraft {
  osmId: string
  name: string
  kind: VenueKind
  cuisine: string[]
  latitude: number
  longitude: number
  address: string | null
  hours: VenueHours
  phone: string | null
  website: string | null
  socials: VenueSocials
}

export interface OverpassArea {
  south?: number
  west?: number
  north?: number
  east?: number
  latitude?: number
  longitude?: number
  radius?: number
}

const AMENITY = 'cafe|restaurant|bar|fast_food|pub|ice_cream'

export function overpassQuery(area: OverpassArea) {
  const around = area.latitude != null && area.longitude != null
  const filter = around
    ? `(around:${Math.round(area.radius || 1000)},${area.latitude},${area.longitude})`
    : `(${area.south},${area.west},${area.north},${area.east})`
  return [
    '[out:json][timeout:25];',
    '(',
    `node["amenity"~"${AMENITY}"]${filter};`,
    `way["amenity"~"${AMENITY}"]${filter};`,
    `node["shop"="bakery"]${filter};`,
    `way["shop"="bakery"]${filter};`,
    ');',
    'out center tags;',
  ].join('\n')
}

export function overpassAreaError(area: OverpassArea) {
  const point = area.latitude != null || area.longitude != null || area.radius != null
  const box = area.south != null || area.west != null || area.north != null || area.east != null
  if (point && box) {
    return 'Укажите либо bbox, либо точку и радиус.'
  }
  if (point) {
    if (area.latitude == null || area.longitude == null) {
      return 'Нужны широта и долгота.'
    }
    if (area.latitude < -90 || area.latitude > 90 || area.longitude < -180 || area.longitude > 180) {
      return 'Координаты вне диапазона.'
    }
    const radius = area.radius ?? 1000
    if (radius <= 0 || radius > 20_000) {
      return 'Радиус: от 1 до 20000 метров.'
    }
    return null
  }
  if (area.south == null || area.west == null || area.north == null || area.east == null) {
    return 'Нужен bbox или точка с радиусом.'
  }
  if (area.south >= area.north || area.west >= area.east) {
    return 'Bbox задан не по порядку.'
  }
  if (area.north - area.south > 1.5 || area.east - area.west > 1.5) {
    return 'Bbox слишком большой.'
  }
  return null
}

export function kindFromOsm(tags: Record<string, string>): VenueKind {
  if (tags.shop === 'bakery') {
    return 'bakery'
  }
  if (tags.amenity === 'restaurant') {
    return 'restaurant'
  }
  if (tags.amenity === 'bar' || tags.amenity === 'pub') {
    return 'bar'
  }
  if (tags.amenity === 'fast_food') {
    return 'fastfood'
  }
  if (tags.amenity === 'ice_cream') {
    return 'other'
  }
  if (tags.amenity === 'cafe') {
    const cuisine = (tags.cuisine || '').toLowerCase().split(';').map((item) => item.trim())
    if (cuisine.includes('coffee') || cuisine.includes('coffee_shop')) {
      return 'coffee'
    }
    return 'cafe'
  }
  return 'other'
}

function padTime(value: string) {
  const [hour, minute] = value.split(':')
  return `${(hour || '0').padStart(2, '0')}:${minute || '00'}`
}

function expandDays(spec: string): VenueWeekday[] {
  const days: VenueWeekday[] = []
  for (const chunk of spec.split(',')) {
    const piece = chunk.trim()
    const range = piece.split(/\s*-\s*/)
    const start = OSM_DAY[range[0]?.slice(0, 2).toLowerCase() || '']
    const end = OSM_DAY[(range[1] || range[0] || '').slice(0, 2).toLowerCase()]
    if (!start || !end) {
      continue
    }
    const from = WEEKDAYS.indexOf(start)
    const to = WEEKDAYS.indexOf(end)
    if (from <= to) {
      days.push(...WEEKDAYS.slice(from, to + 1))
    } else {
      days.push(...WEEKDAYS.slice(from), ...WEEKDAYS.slice(0, to + 1))
    }
  }
  return [...new Set(days)]
}

export function parseOpeningHours(raw: string | undefined): VenueHours {
  const note = raw?.trim() || null
  if (!note) {
    return {}
  }
  if (/^24\s*\/\s*7$/.test(note)) {
    const all: VenueInterval[] = [{ open: '00:00', close: '24:00' }]
    return { mon: all, tue: all, wed: all, thu: all, fri: all, sat: all, sun: all, note }
  }
  const hours: VenueHours = { note }
  let parsed = false
  for (const part of note.split(';')) {
    const rule = part.trim()
    const off = rule.match(/^([A-Z]{2}(?:\s*[-,]\s*[A-Z]{2})*)\s+off$/i)
    if (off?.[1]) {
      for (const day of expandDays(off[1])) {
        hours[day] = []
        parsed = true
      }
      continue
    }
    const timed = rule.match(/^([A-Z]{2}(?:\s*[-,]\s*[A-Z]{2})*)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/i)
    if (!timed?.[1] || !timed[2] || !timed[3]) {
      continue
    }
    const interval = { open: padTime(timed[2]), close: padTime(timed[3]) }
    for (const day of expandDays(timed[1])) {
      const current = Array.isArray(hours[day]) ? hours[day] : []
      hours[day] = [...current, interval]
      parsed = true
    }
  }
  if (!parsed) {
    return { note }
  }
  return hours
}

function tag(tags: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = tags[key]?.trim()
    if (value) {
      return value
    }
  }
  return null
}

export function venueFromOsm(element: OverpassElement): OsmVenueDraft | null {
  const tags = element.tags || {}
  const name = tag(tags, 'name:ru', 'name')
  const latitude = element.lat ?? element.center?.lat
  const longitude = element.lon ?? element.center?.lon
  if (!name || name.length < 2 || latitude == null || longitude == null) {
    return null
  }
  if (element.type !== 'node' && element.type !== 'way') {
    return null
  }
  const cuisine = (tags.cuisine || '').split(';').map((item) => item.trim().toLowerCase()).filter(Boolean).slice(0, 12)
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', ')
  const address = [tags['addr:city'], street].filter(Boolean).join(', ') || null
  return {
    osmId: `${element.type}/${element.id}`,
    name,
    kind: kindFromOsm(tags),
    cuisine,
    latitude,
    longitude,
    address,
    hours: parseOpeningHours(tags.opening_hours),
    phone: tag(tags, 'phone', 'contact:phone'),
    website: tag(tags, 'website', 'contact:website', 'url'),
    socials: {
      instagram: tag(tags, 'contact:instagram', 'instagram'),
      vk: tag(tags, 'contact:vk', 'vk'),
      telegram: tag(tags, 'contact:telegram', 'telegram'),
    },
  }
}
