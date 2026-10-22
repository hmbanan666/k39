import type { PageModule } from './page-modules'
import type { ScheduleRules } from './schedule'
import type { VenueModule } from './venue-modules'
import { createHash } from 'node:crypto'
import { classifyOfficialUrl } from '@k39/types/official-url'
import { z } from 'zod'
import { ADMISSION_AUDIENCES, ADMISSION_CONDITION_MAX, ADMISSION_LABEL_MAX } from './admission'
import { EVENT_TITLE_MAX } from './events'
import { addDays, localNow, scheduleRulesSchema } from './schedule'

// Typed fact values (ADR 0033). Hours reuse the schedule rules. Admission and
// event are the ADR 0046 ledgers beside their rows. Transport, seasonality,
// and history stay out until their phase.

export const FACT_IMPORT_ID = 'typed-facts-v1'

export const PHASE1_KINDS = ['hours', 'price', 'phone', 'address', 'coordinates', 'status'] as const
export const FACT_KINDS = [...PHASE1_KINDS, 'admission', 'event'] as const
export type FactKind = (typeof FACT_KINDS)[number]

export const FACT_SUBJECTS = ['place', 'venue', 'route', 'route_stop', 'region'] as const
export type FactSubject = (typeof FACT_SUBJECTS)[number]

export const SOURCE_KINDS = ['official', 'official_social', 'map_yandex', 'map_2gis', 'map_google', 'osm', 'owner', 'none'] as const
export type SourceKind = (typeof SOURCE_KINDS)[number]

export const CONFIDENCE = ['stated', 'owner', 'gap'] as const
export type FactConfidence = (typeof CONFIDENCE)[number]

export const FACT_ACTORS = ['migration', 'editor', 'owner', 'mcp'] as const
export type FactActor = (typeof FACT_ACTORS)[number]

export const QUEUE_REASONS = ['source_changed', 'ttl_expired', 'fetch_failed', 'source_gone', 'season_boundary', 'section_changed', 'unseeded', 'owner_conflict', 'fact_repeated', 'guest_report'] as const
export type QueueReason = (typeof QUEUE_REASONS)[number]

/** Conflict reasons that make a fact stale for the score and the trust column. */
export const CONFLICT_REASONS = ['source_changed', 'owner_conflict', 'source_gone'] as const

export const FACT_TTL_DAYS: Record<FactKind, number> = {
  hours: 30,
  price: 90,
  phone: 180,
  address: 365,
  coordinates: 365,
  status: 30,
  admission: 90,
  event: 7,
}

export const WATCH_BATCH = 500
export const QUEUE_LOCK_MS = 30 * 60 * 1000
export const SEASON_HORIZON_DAYS = 30

const DAY_MS = 86_400_000

/**
 * Displayed phone. Three numbers fit. The venues.phone copy uses the same
 * max (`PHONE_TEXT_MAX` in `@k39/database`). A test keeps the two in step.
 */
export const PHONE_TEXT_MAX = 200

export const phoneValueSchema = z.object({ text: z.string().trim().min(1).max(PHONE_TEXT_MAX) })
export const addressValueSchema = z.object({ text: z.string().trim().min(1).max(300) })
export const coordinatesValueSchema = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
})
export const priceValueSchema = z.object({
  itemId: z.string().trim().min(1),
  itemSlug: z.string().trim().min(1),
  variant: z.string(),
  priceRub: z.number().int().positive(),
})
export const statusValueSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('place'), status: z.enum(['open', 'ruins', 'closed', 'unknown']) }),
  z.object({ scope: z.literal('venue'), status: z.enum(['open', 'closed']) }),
])

export const admissionValueSchema = z.object({
  audience: z.enum(ADMISSION_AUDIENCES),
  priceRub: z.number().int().nonnegative(),
  condition: z.string().max(ADMISSION_CONDITION_MAX).nullable(),
  label: z.string().max(ADMISSION_LABEL_MAX).nullable(),
})
export const eventValueSchema = z.object({
  title: z.string().trim().min(1).max(EVENT_TITLE_MAX),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }).nullable(),
  ticketUrl: z.string().url().nullable(),
  allDay: z.boolean(),
})

export type PhoneValue = z.infer<typeof phoneValueSchema>
export type AddressValue = z.infer<typeof addressValueSchema>
export type CoordinatesValue = z.infer<typeof coordinatesValueSchema>
export type PriceValue = z.infer<typeof priceValueSchema>
export type StatusValue = z.infer<typeof statusValueSchema>
export type AdmissionValue = z.infer<typeof admissionValueSchema>
export type EventValue = z.infer<typeof eventValueSchema>

export function valueSchema(kind: string) {
  switch (kind) {
    case 'hours': return scheduleRulesSchema
    case 'price': return priceValueSchema
    case 'phone': return phoneValueSchema
    case 'address': return addressValueSchema
    case 'coordinates': return coordinatesValueSchema
    case 'status': return statusValueSchema
    case 'admission': return admissionValueSchema
    case 'event': return eventValueSchema
    default: return null
  }
}

export function parseFactValue(kind: string, value: unknown) {
  const schema = valueSchema(kind)
  if (!schema) {
    return null
  }
  const parsed = schema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** Kind default. A map phone uses the same 180 days as an official phone. */
export function defaultTtl(kind: string) {
  if ((FACT_KINDS as readonly string[]).includes(kind)) {
    return FACT_TTL_DAYS[kind as FactKind]
  }
  return 30
}

export function canonicalJson(value: unknown): string {
  if (value === undefined) {
    return 'null'
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}

export function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex')
}

export function valueHash(value: unknown) {
  return sha256(canonicalJson(value))
}

export function normalizeProse(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

export function proseHash(text: string) {
  return sha256(normalizeProse(text))
}

/** Drop script and style, then collapse whitespace. The body is not stored. */
export function normalizeSourceText(html: string) {
  const stripped = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, '\'')
    .replace(/&quot;/gi, '"')
  return normalizeProse(stripped)
}

export function isBlockedAddress(address: string) {
  const value = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (value === '::1' || value === '::' || value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) {
    return true
  }
  const v4 = value.startsWith('::ffff:') ? value.slice('::ffff:'.length) : value
  const parts = v4.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }
  const a = parts[0] ?? -1
  const b = parts[1] ?? -1
  return a === 0 || a === 10 || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224
}

export function isBlockedHostname(host: string) {
  const name = host.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '')
  return !name || name === 'localhost' || name.endsWith('.local') || name.endsWith('.internal') || name.endsWith('.localhost')
}

function bareHost(host: string) {
  return host.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
}

/** Map cards are never fetched. They queue on TTL instead. */
export function isUnwatchedUrl(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const host = bareHost(parsed.hostname)
  const yandex = /(?:^|\.)yandex\.(?:ru|com|by|kz|uz)$/.test(host) || host === 'ya.ru' || host.endsWith('.ya.ru')
  if (yandex && (host.startsWith('maps.') || parsed.pathname.includes('/maps'))) {
    return true
  }
  return /(?:^|\.)2gis\.(?:ru|com|kz|uz)$/.test(host)
    || isGoogleMaps(host, parsed.pathname)
    || /(?:^|\.)openstreetmap\.org$/.test(host)
    || host === 'osm.org'
    || host.endsWith('.osm.org')
}

function isGoogleMaps(host: string, pathname: string) {
  if (host === 'maps.app.goo.gl' || host.endsWith('.maps.app.goo.gl') || host === 'maps.google.com' || host.endsWith('.maps.google.com')) {
    return true
  }
  if (host === 'goo.gl' && (pathname === '/maps' || pathname.startsWith('/maps/'))) {
    return true
  }
  return /^google\.(?:com|ru|de|fr|co\.uk|lt|pl|kz|by)$/.test(host) && (pathname === '/maps' || pathname.startsWith('/maps/'))
}

export function classifySourceUrl(url: string | null | undefined): Exclude<SourceKind, 'owner'> {
  if (!url?.trim()) {
    return 'none'
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'none'
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'none'
  }
  const host = bareHost(parsed.hostname)
  if (/(?:^|\.)2gis\.(?:ru|com|kz|uz)$/.test(host)) {
    return 'map_2gis'
  }
  if (isGoogleMaps(host, parsed.pathname)) {
    return 'map_google'
  }
  if (host === 'openstreetmap.org' || host.endsWith('.openstreetmap.org') || host === 'osm.org' || host.endsWith('.osm.org')) {
    return 'osm'
  }
  const yandex = /(?:^|\.)yandex\.(?:ru|com|by|kz|uz)$/.test(host) || host === 'ya.ru' || host.endsWith('.ya.ru')
  if (yandex && (host.startsWith('maps.') || parsed.pathname.includes('/maps'))) {
    return 'map_yandex'
  }
  const kind = classifyOfficialUrl(url)
  if (kind === 'social') {
    return 'official_social'
  }
  return kind === 'official' ? 'official' : 'none'
}

/** Menu prices also allow official document hosts; other fact kinds do not. */
export function classifyMenuSourceUrl(url: string | null | undefined): Exclude<SourceKind, 'owner'> {
  return classifyOfficialUrl(url) === 'document' ? 'official' : classifySourceUrl(url)
}

export function watchableSource(kind: SourceKind, url: string | null | undefined) {
  if (kind !== 'official' && kind !== 'official_social') {
    return false
  }
  if (!url) {
    return false
  }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }
    if (parsed.username || parsed.password || isBlockedHostname(parsed.hostname) || isUnwatchedUrl(url)) {
      return false
    }
    return true
  } catch {
    return false
  }
}

export function pastTtl(checkedAt: string | null, ttlDays: number, now = new Date()) {
  if (!checkedAt) {
    return false
  }
  const checked = new Date(checkedAt).getTime()
  if (Number.isNaN(checked)) {
    return false
  }
  return now.getTime() - checked >= ttlDays * DAY_MS
}

export function factRisk(kind: string, reason: string) {
  const base = kind === 'status' || kind === 'hours' || kind === 'transport'
    ? 5
    : kind === 'price' || kind === 'admission' || kind === 'seasonality' || kind === 'event'
      ? 3
      : kind === 'phone' || kind === 'address' || kind === 'coordinates'
        ? 2
        : 1
  return base + (reason === 'season_boundary' ? 2 : 0)
}

export function pageTraffic(pageviews: number, impressions: number) {
  const sum = Math.max(0, pageviews) + Math.max(0, impressions)
  return sum > 0 ? sum : 1
}

export function priorityFor(kind: string, reason: string, traffic: number) {
  return factRisk(kind, reason) * Math.round(Math.log(1 + Math.max(0, traffic)))
}

/** The token may confirm the same value. A different value waits for an editor. */
export function ownerBlocksToken(latestActor: string | null, sameClaim: boolean) {
  return latestActor === 'owner' && !sameClaim
}

const MAP_SOURCES = new Set(['map_yandex', 'map_2gis', 'map_google', 'osm'])
const MAP_FIELDS = new Set(['hours', 'phone', 'address', 'coordinates', 'status'])

/** Map cards are venue facts only, and only the fields a map is allowed to fill. */
export function mapSourceAllowed(subjectType: string, kind: string, sourceKind: string) {
  if (!MAP_SOURCES.has(sourceKind)) {
    return true
  }
  return subjectType === 'venue' && MAP_FIELDS.has(kind)
}

/**
 * One rule for «the subject's own page» (place or venue website, place phone
 * source, venue menu). The classifier lives in `@k39/types` so the database
 * venue writer applies the same check.
 */
export { classifyOfficialUrl, isOfficialUrl, ownWebsiteMessage, ownWebsiteProblem } from '@k39/types/official-url'
export type { OfficialUrlClass, OwnWebsiteProblem } from '@k39/types/official-url'

/** Write the contact fact when the value changed, or when the column was saved before a fact row existed. */
export function shouldWriteContact(changed: boolean, hasFact: boolean, next: string | null) {
  if (changed) {
    return true
  }
  return !hasFact && Boolean(next)
}

export function hoursLookEmpty(rules: ScheduleRules) {
  return rules.mode === 'hours'
    && rules.seasons.every((season) => season.week.length === 0)
    && rules.occurrences.length === 0
    && rules.exceptions.length === 0
    && !rules.note
}

export type SeedDisposition = 'skip' | 'gap' | 'stated'

/**
 * What the fact seed stores.
 * A filled column with no URL is skipped: it is not a gap and not a sourced fact.
 * A gap is only the explicit unknown (empty hours), and that row does not copy a filled column.
 * A stated fact needs a source kind other than `none`.
 */
export function seedFactDisposition(input: { sourceKind: string, empty: boolean }): SeedDisposition {
  if (input.empty) {
    return 'gap'
  }
  if (input.sourceKind === 'none') {
    return 'skip'
  }
  return 'stated'
}

export function seasonBoundaryWithin(rules: { seasons?: Array<{ from?: string, to?: string }> }, now = new Date(), horizon = SEASON_HORIZON_DAYS) {
  const marks = new Set<string>()
  for (const season of rules.seasons ?? []) {
    if (season.from) {
      marks.add(season.from)
    }
    if (season.to) {
      marks.add(season.to)
    }
  }
  if (!marks.size) {
    return false
  }
  const start = localNow(now).date
  for (let offset = 0; offset <= horizon; offset += 1) {
    if (marks.has(addDays(start, offset).slice(5))) {
      return true
    }
  }
  return false
}

export type WatchAction
  = | { type: 'renew' }
    | { type: 'changed' }
    | { type: 'record' }
    | { type: 'gone' }
    | { type: 'backoff', delayDays: number, queue: boolean, failCount: number }

export function decideWatch(input: {
  status: number | null
  error: boolean
  previousHash: string | null
  nextHash: string | null
  failCount: number
}): WatchAction {
  if (input.error || (input.status != null && input.status >= 500)) {
    const failCount = input.failCount + 1
    const delayDays = Math.min(2 ** (failCount - 1), 14)
    return { type: 'backoff', delayDays, queue: failCount >= 3, failCount }
  }
  if (input.status === 404 || input.status === 410) {
    return { type: 'gone' }
  }
  if (input.status === 304 || (input.previousHash != null && input.previousHash === input.nextHash)) {
    return { type: 'renew' }
  }
  if (!input.previousHash) {
    return { type: 'record' }
  }
  return { type: 'changed' }
}

export function backoffUntil(now: Date, delayDays: number) {
  return new Date(now.getTime() + delayDays * DAY_MS).toISOString()
}

export interface RenderedSection {
  path: string
  text: string
  hash: string
}

export function hashSections(parts: Array<{ path: string, text: string }>): RenderedSection[] {
  const sections: RenderedSection[] = []
  for (const part of parts) {
    const text = normalizeProse(part.text)
    if (!text) {
      continue
    }
    sections.push({ path: part.path, text, hash: sha256(text) })
  }
  return sections
}

export function placeSections(input: { summary?: string | null, sections?: Array<{ text?: string | null }>, faq?: Array<{ question?: string | null, answer?: string | null }> }) {
  const parts: Array<{ path: string, text: string }> = []
  if (input.summary) {
    parts.push({ path: 'summary', text: input.summary })
  }
  input.sections?.forEach((section, index) => {
    parts.push({ path: `sections[${index}]`, text: section.text ?? '' })
  })
  input.faq?.forEach((item, index) => {
    parts.push({ path: `faq[${index}]`, text: `${item.question ?? ''}\n${item.answer ?? ''}` })
  })
  return hashSections(parts)
}

export function articleSections(input: { summary?: string | null, sections?: Array<{ text?: string | null }>, body?: string | null }) {
  if (input.sections?.length) {
    return placeSections({ summary: input.summary, sections: input.sections })
  }
  const parts: Array<{ path: string, text: string }> = []
  if (input.summary) {
    parts.push({ path: 'summary', text: input.summary })
  }
  splitPlain(input.body ?? '').forEach((text, index) => {
    parts.push({ path: `sections[${index}]`, text })
  })
  return hashSections(parts)
}

function splitPlain(markdown: string) {
  return markdown.split(/\n(?=## )/).map((part) => part.trim()).filter(Boolean)
}

export function moduleProse(module: PageModule) {
  switch (module.type) {
    case 'text':
      return [module.title, module.text].filter(Boolean).join('\n')
    case 'month-stats':
      return [
        module.title,
        module.verdict,
        ...module.tiles.flatMap((tile) => [tile.label, tile.value, tile.note]),
        ...module.rows.flatMap((row) => [row.label, row.value]),
      ].filter(Boolean).join('\n')
    case 'ideas':
    case 'plans':
      return [module.title, ...module.items.flatMap((item) => [item.title, item.text])].join('\n')
    case 'places':
      return module.title
    case 'months':
      return module.title ?? ''
    default:
      return ''
  }
}

export function collectionSections(input: { summary?: string | null, body?: string | null, modules?: PageModule[] | null }) {
  if (input.modules?.length) {
    return hashSections(input.modules.map((module, index) => ({ path: `modules[${index}]`, text: moduleProse(module) })))
  }
  return articleSections({ summary: input.summary, body: input.body })
}

export function venueModuleProse(module: VenueModule) {
  switch (module.type) {
    case 'text':
    case 'best-time':
      return [module.title, module.text].filter(Boolean).join('\n')
    case 'how-to-get':
      return module.text
    case 'dishes':
      return [
        module.title,
        module.note,
        ...module.items.flatMap((item) => [item.name, item.description, item.note]),
      ].filter(Boolean).join('\n')
    case 'audience':
      return [module.title, ...module.items.flatMap((item) => [item.who, item.text])].filter(Boolean).join('\n')
    case 'practical':
      return [module.title, ...module.items.flatMap((item) => [item.label, item.value])].filter(Boolean).join('\n')
    case 'tips':
      return [module.title, ...module.items].filter(Boolean).join('\n')
    case 'faq':
      return [module.title, ...module.items.flatMap((item) => [item.question, item.answer])].filter(Boolean).join('\n')
    case 'prices':
      return module.title ?? ''
  }
}

export function venueSections(input: { description?: string | null, modules?: VenueModule[] | null }) {
  const parts: Array<{ path: string, text: string }> = []
  if (input.description) {
    parts.push({ path: 'summary', text: input.description })
  }
  input.modules?.forEach((module, index) => {
    parts.push({ path: `modules[${index}]`, text: venueModuleProse(module) })
  })
  return hashSections(parts)
}

export function questSections(input: { summary?: string | null, body?: string | null, steps?: Array<{ title?: string | null, prompt?: string | null }> }) {
  const parts: Array<{ path: string, text: string }> = []
  if (input.summary) {
    parts.push({ path: 'summary', text: input.summary })
  }
  splitPlain(input.body ?? '').forEach((text, index) => {
    parts.push({ path: `sections[${index}]`, text })
  })
  input.steps?.forEach((step, index) => {
    parts.push({ path: `steps[${index}]`, text: `${step.title ?? ''}\n${step.prompt ?? ''}` })
  })
  return hashSections(parts)
}

export function unreviewedSections(current: RenderedSection[], reviewed: Array<{ path: string, hash: string }>) {
  const hashes = new Set(reviewed.map((item) => item.hash))
  return current.filter((section) => !hashes.has(section.hash))
}

export interface ReviewWrite {
  ok: boolean
  rejected: string[]
  sections: Array<{ path: string, hash: string }>
}

/**
 * `all` stores every current section only when each submitted hash still
 * matches. A single path stores when that path still matches, and hashes
 * that no longer belong to any section are dropped.
 */
export function reviewUpdate(current: RenderedSection[], stored: Array<{ path: string, hash: string }>, submitted: Array<{ path: string, hash: string }>, all: boolean): ReviewWrite {
  const live = new Map(current.map((section) => [section.path, section.hash]))
  const submittedByPath = new Map(submitted.map((item) => [item.path, item.hash]))
  if (all) {
    const rejected = current.filter((section) => submittedByPath.get(section.path) !== section.hash).map((section) => section.path)
    if (rejected.length || current.length !== submitted.length) {
      const missing = current.filter((section) => !submittedByPath.has(section.path)).map((section) => section.path)
      return { ok: false, rejected: [...new Set([...rejected, ...missing])], sections: stored }
    }
    return { ok: true, rejected: [], sections: current.map((section) => ({ path: section.path, hash: section.hash })) }
  }
  const accepted = new Map(stored.map((item) => [item.path, item.hash]))
  const rejected: string[] = []
  for (const item of submitted) {
    if (live.get(item.path) !== item.hash) {
      rejected.push(item.path)
      continue
    }
    accepted.set(item.path, item.hash)
  }
  const liveHashes = new Set(current.map((section) => section.hash))
  const sections = [...accepted.entries()]
    .filter(([, hash]) => liveHashes.has(hash))
    .map(([path, hash]) => ({ path, hash }))
  return { ok: rejected.length === 0, rejected, sections }
}

export interface TrustCounts {
  verified: boolean
  staleFacts: number
  unreviewed: number
  labels: Array<'verified' | 'stale' | 'unreviewed'>
}

export function trustOf(input: { staleFacts: number, unreviewed: number }): TrustCounts {
  const verified = input.staleFacts === 0 && input.unreviewed === 0
  if (verified) {
    return { verified: true, staleFacts: 0, unreviewed: 0, labels: ['verified'] }
  }
  const labels: Array<'stale' | 'unreviewed'> = []
  if (input.staleFacts > 0) {
    labels.push('stale')
  }
  if (input.unreviewed > 0) {
    labels.push('unreviewed')
  }
  return { verified: false, staleFacts: input.staleFacts, unreviewed: input.unreviewed, labels }
}

export function trustText(trust: TrustCounts) {
  if (trust.verified) {
    return 'проверено'
  }
  const parts: string[] = []
  if (trust.staleFacts > 0) {
    parts.push(`${trust.staleFacts} ${trust.staleFacts === 1 ? 'устарел' : 'устарели'}`)
  }
  if (trust.unreviewed > 0) {
    parts.push(`${trust.unreviewed} ${sectionWord(trust.unreviewed)}`)
  }
  return parts.join(', ')
}

function sectionWord(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) {
    return 'раздел'
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'раздела'
  }
  return 'разделов'
}

export function queueMayOpen(status: string | null, reason: QueueReason) {
  if (status === 'archived' || status === 'draft') {
    return false
  }
  if (status === 'review') {
    return reason === 'section_changed'
  }
  return status === 'published' || status === 'closed' || status === null
}

export interface FactProposal {
  value: unknown
  sourceUrl: string | null
  sourceTitle: string | null
  sourceKind: SourceKind
  confidence: FactConfidence
  ttlDays: number
  checkedAt: string | null
}
