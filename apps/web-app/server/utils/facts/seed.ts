import type { SourceLink } from '@k39/database'
import { db, tables, useDatabase } from '@k39/database'
import { eq } from 'drizzle-orm'
import { classifySourceUrl, defaultTtl, FACT_IMPORT_ID, hoursLookEmpty } from '../../../shared/facts'
import { readRules } from '../../../shared/schedule'
import { commitFact } from './commit'
import { loadPageSnapshots } from './pages'

const { places, priceItems, schedules, venuePrices, venues } = tables

/**
 * One boot copies schedules, prices, and venue contact fields into facts,
 * and marks the prose that already renders as reviewed. A second boot
 * sees the content_imports row and writes nothing.
 */
export async function applyFactLayer() {
  if (await db.facts.importApplied(FACT_IMPORT_ID)) {
    return { applied: false }
  }
  const database = useDatabase()
  const scheduleRows = await database.select().from(schedules)
  const placeRows = await database.select({
    id: places.id,
    status: places.status,
    latitude: places.latitude,
    longitude: places.longitude,
    lastVerifiedAt: places.lastVerifiedAt,
    publicationStatus: places.publicationStatus,
  }).from(places)
  const venueRows = await database.select({
    id: venues.id,
    phone: venues.phone,
    address: venues.address,
    latitude: venues.latitude,
    longitude: venues.longitude,
    website: venues.website,
    sources: venues.sources,
    status: venues.status,
    lastVerifiedAt: venues.lastVerifiedAt,
  }).from(venues)
  const priceRows = await database.select({
    venueId: venuePrices.venueId,
    itemId: venuePrices.itemId,
    itemSlug: priceItems.slug,
    variant: venuePrices.variant,
    priceRub: venuePrices.priceRub,
    checkedAt: venuePrices.checkedAt,
    sourceKind: venuePrices.sourceKind,
    sourceTitle: venuePrices.sourceTitle,
    sourceUrl: venuePrices.sourceUrl,
  }).from(venuePrices).innerJoin(priceItems, eq(venuePrices.itemId, priceItems.id))

  const placeStatus = new Map(placeRows.map((row) => [row.id, row.publicationStatus]))
  const venueStatus = new Map(venueRows.map((row) => [row.id, row.status]))
  const scheduleByVenue = new Map(scheduleRows.filter((row) => row.entityType === 'venue').map((row) => [row.entityId, row.sourceUrl]))
  const priceUrls = new Map<string, string[]>()
  for (const row of priceRows) {
    if (!row.sourceUrl) {
      continue
    }
    const list = priceUrls.get(row.venueId) ?? []
    list.push(row.sourceUrl)
    priceUrls.set(row.venueId, list)
  }

  for (const row of scheduleRows) {
    if (row.entityType !== 'place' && row.entityType !== 'venue') {
      continue
    }
    const rules = readRules(row.rules)
    if (!rules) {
      continue
    }
    const empty = hoursLookEmpty(rules)
    const unchecked = empty || !row.verifiedAt || rules.needsCheck
    const sourceKind = empty || !row.sourceUrl ? 'none' : classifySourceUrl(row.sourceUrl)
    await commitFact({
      kind: 'hours',
      subjectType: row.entityType,
      subjectId: row.entityId,
      slot: 'hours',
      value: rules,
      sourceUrl: sourceKind === 'none' ? null : row.sourceUrl,
      sourceTitle: null,
      sourceKind,
      checkedAt: unchecked ? null : dateStamp(row.verifiedAt),
      ttlDays: defaultTtl('hours'),
      confidence: empty || sourceKind === 'none' ? 'gap' : 'stated',
      actor: 'migration',
      refs: [{ consumerType: row.entityType, consumerId: row.entityId, path: 'short.hours' }],
      pageType: row.entityType,
      pageStatus: row.entityType === 'place' ? placeStatus.get(row.entityId) : venueStatus.get(row.entityId),
    })
  }

  for (const row of priceRows) {
    const sourceKind = row.sourceKind === 'owner' ? 'owner' : (row.sourceUrl ? classifySourceUrl(row.sourceUrl) : 'official')
    await commitFact({
      kind: 'price',
      subjectType: 'venue',
      subjectId: row.venueId,
      slot: priceSlot(row.itemId, row.variant),
      value: { itemId: row.itemId, itemSlug: row.itemSlug, variant: row.variant, priceRub: row.priceRub },
      sourceUrl: sourceKind === 'owner' ? null : row.sourceUrl,
      sourceTitle: row.sourceTitle,
      sourceKind,
      checkedAt: dateStamp(row.checkedAt),
      ttlDays: defaultTtl('price'),
      confidence: sourceKind === 'owner' ? 'owner' : 'stated',
      actor: 'migration',
      refs: [{ consumerType: 'venue', consumerId: row.venueId, path: 'modules.prices' }],
      pageType: 'venue',
      pageStatus: venueStatus.get(row.venueId),
    })
  }

  for (const venue of venueRows) {
    const citation = contactCitation(venue.sources, venue.website, scheduleByVenue.get(venue.id) ?? null, priceUrls.get(venue.id) ?? [])
    const checkedAt = venue.lastVerifiedAt
    const pageStatus = venue.status
    if (venue.phone?.trim()) {
      await commitFact(contactFact('phone', venue.id, { text: venue.phone.trim() }, citation, checkedAt, pageStatus))
    }
    if (venue.address?.trim()) {
      await commitFact(contactFact('address', venue.id, { text: venue.address.trim() }, citation, checkedAt, pageStatus))
    }
    if (venue.latitude != null && venue.longitude != null) {
      await commitFact(contactFact('coordinates', venue.id, { latitude: venue.latitude, longitude: venue.longitude }, citation, checkedAt, pageStatus))
    }
    if (venue.status === 'closed') {
      await commitFact({
        kind: 'status',
        subjectType: 'venue',
        subjectId: venue.id,
        slot: 'status',
        value: { scope: 'venue', status: 'closed' },
        sourceUrl: citation?.url ?? null,
        sourceTitle: citation?.title ?? null,
        sourceKind: citation ? classifySourceUrl(citation.url) : 'none',
        checkedAt,
        ttlDays: defaultTtl('status'),
        confidence: citation ? 'stated' : 'gap',
        actor: 'migration',
        refs: [{ consumerType: 'venue', consumerId: venue.id, path: 'short.status' }],
        pageType: 'venue',
        pageStatus,
        markUnseeded: !citation || !checkedAt,
      })
    }
  }

  for (const place of placeRows) {
    await commitFact({
      kind: 'status',
      subjectType: 'place',
      subjectId: place.id,
      slot: 'status',
      value: { scope: 'place', status: place.status },
      sourceUrl: null,
      sourceTitle: null,
      sourceKind: 'none',
      checkedAt: place.lastVerifiedAt,
      ttlDays: defaultTtl('status'),
      confidence: place.status === 'unknown' ? 'gap' : 'stated',
      actor: 'migration',
      refs: [{ consumerType: 'place', consumerId: place.id, path: 'short.status' }],
      pageType: 'place',
      pageStatus: place.publicationStatus,
    })
    if (place.latitude != null && place.longitude != null) {
      await commitFact({
        kind: 'coordinates',
        subjectType: 'place',
        subjectId: place.id,
        slot: 'coordinates',
        value: { latitude: place.latitude, longitude: place.longitude },
        sourceUrl: null,
        sourceTitle: null,
        sourceKind: 'none',
        checkedAt: place.lastVerifiedAt,
        ttlDays: defaultTtl('coordinates'),
        confidence: place.lastVerifiedAt ? 'stated' : 'gap',
        actor: 'migration',
        refs: [{ consumerType: 'place', consumerId: place.id, path: 'short.coordinates' }],
        pageType: 'place',
        pageStatus: place.publicationStatus,
      })
    }
  }

  const pages = await loadPageSnapshots()
  for (const page of pages) {
    await db.facts.saveReview({
      pageType: page.pageType,
      entityId: page.entityId,
      reviewer: 'migration',
      sections: page.sections.map((section) => ({ path: section.path, hash: section.hash })),
    })
  }
  await db.facts.markImport(FACT_IMPORT_ID)
  return { applied: true }
}

function contactFact(kind: 'phone' | 'address' | 'coordinates', venueId: string, value: unknown, citation: { title: string, url: string } | null, checkedAt: string | null, pageStatus: string) {
  const sourceKind = !checkedAt || !citation ? 'none' : classifySourceUrl(citation.url)
  return {
    kind,
    subjectType: 'venue' as const,
    subjectId: venueId,
    slot: kind,
    value,
    sourceUrl: sourceKind === 'none' ? null : citation?.url ?? null,
    sourceTitle: sourceKind === 'none' ? null : citation?.title ?? null,
    sourceKind,
    checkedAt,
    ttlDays: defaultTtl(kind),
    confidence: sourceKind === 'none' ? 'gap' as const : 'stated' as const,
    actor: 'migration' as const,
    refs: [{ consumerType: 'venue', consumerId: venueId, path: `short.${kind}` }],
    pageType: 'venue',
    pageStatus,
    markUnseeded: sourceKind === 'none' || !checkedAt,
  }
}

function contactCitation(sources: SourceLink[], website: string | null, scheduleUrl: string | null, prices: string[]) {
  const allowed = new Set([website, scheduleUrl, ...prices].filter((url): url is string => Boolean(url)))
  const matches = sources.filter((source) => allowed.has(source.url))
  const unique = [...new Map(matches.map((source) => [source.url, source])).values()]
  return unique.length === 1 ? unique[0]! : null
}

function priceSlot(itemId: string, variant: string) {
  return `price:${itemId}:${variant}`
}

function dateStamp(value: string | null) {
  if (!value) {
    return null
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00.000Z`
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}
