import type { ContentTx, VenuePriceInput } from '@k39/database'
import type { FactActor, SourceKind } from '../../../shared/facts'
import type { ScheduleRecord, ScheduleRules } from '../../../shared/schedule'
import { db } from '@k39/database'
import {
  classifyMenuSourceUrl,
  classifySourceUrl,
  defaultTtl,
  hoursLookEmpty,
  ownerBlocksToken,
  seedFactDisposition,
  shouldWriteContact,
  valueHash,
} from '../../../shared/facts'
import { readRules } from '../../../shared/schedule'
import { rejectBannedSites } from '../mcp/writing-guard'
import { commitFact, retireFactSlot } from './commit'

export async function hoursConflict(
  entityType: 'place' | 'venue',
  entityId: string,
  record: ScheduleRecord,
  actor: FactActor,
  tx?: ContentTx,
) {
  if (actor !== 'mcp') {
    return null
  }
  const rules = readRules(record.rules)
  if (!rules) {
    return null
  }
  const existing = await db.facts.liveSlot(entityType, entityId, 'hours', tx)
  if (!existing) {
    return null
  }
  const latest = await db.facts.latestActor(existing.id, tx)
  const next = hoursClaim(rules, record)
  if (!next.store) {
    return null
  }
  const same =
    existing.valueHash === valueHash(next.value) &&
    existing.sourceKind === next.sourceKind &&
    (existing.sourceUrl ?? null) === next.sourceUrl &&
    existing.confidence === next.confidence
  if (!ownerBlocksToken(latest, same)) {
    return null
  }
  const queued = await commitFact(
    {
      kind: 'hours',
      subjectType: entityType,
      subjectId: entityId,
      slot: 'hours',
      value: next.value,
      sourceUrl: next.sourceUrl,
      sourceTitle: next.sourceTitle,
      sourceKind: next.sourceKind,
      checkedAt: next.checkedAt,
      confidence: next.confidence,
      actor,
      refs: [{ consumerType: entityType, consumerId: entityId, path: 'short.hours' }],
      pageType: entityType,
      pageStatus: 'published',
    },
    tx,
  )
  return queued.conflict ? queued : null
}

export async function writeHoursFact(
  entityType: 'place' | 'venue',
  entityId: string,
  record: ScheduleRecord,
  actor: FactActor,
  pageStatus?: string | null,
  tx?: ContentTx,
) {
  const rules = readRules(record.rules)
  if (!rules) {
    return
  }
  const next = hoursClaim(rules, record)
  if (actor === 'owner') {
    next.sourceKind = 'owner'
    next.sourceUrl = null
    next.sourceTitle = null
    next.confidence = 'owner'
    next.checkedAt = next.checkedAt ?? new Date().toISOString()
    next.store = true
  }
  if (!next.store) {
    return
  }
  await commitFact(
    {
      kind: 'hours',
      subjectType: entityType,
      subjectId: entityId,
      slot: 'hours',
      value: next.value,
      sourceUrl: next.sourceUrl,
      sourceTitle: next.sourceTitle,
      sourceKind: next.sourceKind,
      checkedAt: next.checkedAt,
      confidence: next.confidence,
      actor,
      refs: [{ consumerType: entityType, consumerId: entityId, path: 'short.hours' }],
      pageType: entityType,
      pageStatus: pageStatus ?? 'published',
      markUnseeded: !next.checkedAt,
    },
    tx,
  )
}

function hoursClaim(
  rules: ScheduleRules,
  record: ScheduleRecord,
): {
  value: ScheduleRules
  sourceUrl: string | null
  sourceTitle: string | null
  sourceKind: SourceKind
  checkedAt: string | null
  confidence: 'stated' | 'owner' | 'gap'
  /** False when the rules are a filled column with no source. That is not a gap. */
  store: boolean
} {
  const empty = hoursLookEmpty(rules)
  const unchecked = empty || !record.verifiedAt || rules.needsCheck
  const sourceKind = empty || !record.sourceUrl ? ('none' as const) : classifySourceUrl(record.sourceUrl)
  const disposition = seedFactDisposition({ sourceKind, empty })
  return {
    value: rules,
    sourceUrl: sourceKind === 'none' ? null : record.sourceUrl,
    sourceTitle: null,
    sourceKind,
    checkedAt: unchecked || !record.verifiedAt ? null : `${record.verifiedAt.slice(0, 10)}T00:00:00.000Z`,
    confidence: disposition === 'stated' ? ('stated' as const) : ('gap' as const),
    store: disposition !== 'skip',
  }
}

export async function setVenuePrices(
  venueId: string,
  prices: VenuePriceInput[],
  actor: FactActor,
  pageStatus?: string | null,
  tx?: ContentTx,
) {
  rejectBannedSites(prices.map((row) => ({ sourceUrl: row.sourceUrl, sourceTitle: row.sourceTitle })))
  const catalog = new Map((await db.prices.items(tx)).map((item) => [item.slug, item]))
  const current = await db.prices.forVenue(venueId, tx)
  const incoming = new Map(prices.map((row) => [priceKey(row.item, row.variant), row]))
  const final: VenuePriceInput[] = []
  const conflicts: string[] = []
  const kept = new Set<string>()
  const conflictKeys = new Set<string>()

  for (const row of current) {
    const item = catalog.get(row.item)
    if (!item) {
      continue
    }
    const key = priceKey(row.item, row.variant)
    const next = incoming.get(key)
    const existing = await db.facts.liveSlot('venue', venueId, `price:${item.id}:${row.variant}`, tx)
    const latest = existing ? await db.facts.latestActor(existing.id, tx) : null
    const same = Boolean(
      next &&
      next.priceRub === row.priceRub &&
      next.sourceKind === row.sourceKind &&
      (next.sourceUrl ?? null) === row.sourceUrl,
    )
    if (actor === 'mcp' && ownerBlocksToken(latest, same)) {
      final.push({
        item: row.item,
        variant: row.variant,
        priceRub: row.priceRub,
        checkedAt: row.checkedAt,
        sourceKind: row.sourceKind,
        sourceTitle: row.sourceTitle,
        sourceUrl: row.sourceUrl,
      })
      kept.add(key)
      conflictKeys.add(key)
      if (next) {
        const queued = await commitFact(
          {
            kind: 'price',
            subjectType: 'venue',
            subjectId: venueId,
            slot: `price:${item.id}:${row.variant}`,
            value: { itemId: item.id, itemSlug: item.slug, variant: row.variant, priceRub: Math.round(next.priceRub) },
            sourceUrl: next.sourceKind === 'owner' ? null : (next.sourceUrl ?? null),
            sourceTitle: next.sourceTitle,
            sourceKind: next.sourceKind === 'owner' ? 'owner' : classifyMenuSourceUrl(next.sourceUrl),
            checkedAt: dateStamp(next.checkedAt),
            confidence: next.sourceKind === 'owner' ? 'owner' : 'stated',
            actor,
            refs: [{ consumerType: 'venue', consumerId: venueId, path: 'modules.prices' }],
            pageType: 'venue',
            pageStatus: pageStatus ?? 'published',
          },
          tx,
        )
        if (queued.conflict) {
          conflicts.push(queued.queueId)
        }
      } else if (existing) {
        const queued = await db.facts.enqueue(
          {
            target: 'fact',
            factId: existing.id,
            pageType: 'venue',
            entityId: venueId,
            path: 'modules.prices',
            reason: 'owner_conflict',
            proposal: { retire: true },
          },
          tx,
        )
        conflicts.push(queued.id)
      }
      continue
    }
    if (next) {
      final.push(next)
      kept.add(key)
    }
  }
  for (const row of prices) {
    if (!kept.has(priceKey(row.item, row.variant))) {
      final.push(row)
    }
  }

  const saved = await db.prices.setForVenue(venueId, final, tx)
  const savedKeys = new Set(saved.map((row) => priceKey(row.item, row.variant)))
  for (const row of current) {
    if (!savedKeys.has(priceKey(row.item, row.variant))) {
      const item = catalog.get(row.item)
      if (item) {
        await retireFactSlot('venue', venueId, `price:${item.id}:${row.variant}`, tx)
      }
    }
  }
  for (const row of saved) {
    if (conflictKeys.has(priceKey(row.item, row.variant))) {
      continue
    }
    const item = catalog.get(row.item)
    if (!item) {
      continue
    }
    const keptOwner =
      kept.has(priceKey(row.item, row.variant)) && actor === 'mcp' && conflicts.length
        ? current.find((itemRow) => priceKey(itemRow.item, itemRow.variant) === priceKey(row.item, row.variant))
        : null
    const writeActor: FactActor = keptOwner && keptOwner.priceRub === row.priceRub ? 'owner' : actor
    const sourceKind = row.sourceKind === 'owner' ? ('owner' as const) : classifyMenuSourceUrl(row.sourceUrl)
    await commitFact(
      {
        kind: 'price',
        subjectType: 'venue',
        subjectId: venueId,
        slot: `price:${item.id}:${row.variant}`,
        value: { itemId: item.id, itemSlug: item.slug, variant: row.variant, priceRub: row.priceRub },
        sourceUrl: sourceKind === 'owner' ? null : row.sourceUrl,
        sourceTitle: row.sourceTitle,
        sourceKind,
        checkedAt: dateStamp(row.checkedAt),
        confidence: sourceKind === 'owner' ? 'owner' : 'stated',
        actor: writeActor,
        refs: [{ consumerType: 'venue', consumerId: venueId, path: 'modules.prices' }],
        pageType: 'venue',
        pageStatus: pageStatus ?? 'published',
      },
      tx,
    )
  }
  return { prices: saved, conflicts }
}

export async function syncVenueContact(input: {
  tx?: ContentTx
  venueId: string
  actor: FactActor
  pageStatus?: string | null
  phone?: string | null
  address?: string | null
  status?: string | null
  previous: { phone: string | null; address: string | null; status: string }
}) {
  const conflicts: string[] = []
  const skipped = { phone: false, address: false, status: false }
  if (await contactChanged(input, 'phone')) {
    const blocked = await blockField(input, 'phone', input.phone ? { text: input.phone.trim() } : null)
    if (blocked) {
      skipped.phone = true
      conflicts.push(blocked)
    } else if (input.phone?.trim()) {
      await writeContact(input, 'phone', { text: input.phone.trim() })
    } else {
      await retireFactSlot('venue', input.venueId, 'phone', input.tx)
    }
  }
  if (await contactChanged(input, 'address')) {
    const blocked = await blockField(input, 'address', input.address ? { text: input.address.trim() } : null)
    if (blocked) {
      skipped.address = true
      conflicts.push(blocked)
    } else if (input.address?.trim()) {
      await writeContact(input, 'address', { text: input.address.trim() })
    } else {
      await retireFactSlot('venue', input.venueId, 'address', input.tx)
    }
  }
  if (input.status !== undefined && input.status !== input.previous.status) {
    const next = input.status === 'closed' ? { scope: 'venue' as const, status: 'closed' as const } : null
    const blocked = await blockField(input, 'status', next)
    if (blocked) {
      skipped.status = true
      conflicts.push(blocked)
    } else if (next) {
      await writeContact(input, 'status', next)
    } else {
      await retireFactSlot('venue', input.venueId, 'status', input.tx)
    }
  }
  return { conflicts, skipped }
}

/**
 * Upsert the coordinates fact when a place or venue save writes the point.
 * An unchanged point still creates the fact when none exists, so a later
 * column edit cannot hide behind a missing row. A blocked owner fact keeps
 * the previous column value.
 */
export async function syncCoordinates(input: {
  subjectType: 'place' | 'venue'
  subjectId: string
  actor: FactActor
  pageStatus?: string | null
  latitude?: number | null
  longitude?: number | null
  previous: { latitude: number | null; longitude: number | null }
  /** When set, the fact write joins this save and rolls back with it. */
  tx?: ContentTx
}) {
  if (input.latitude === undefined && input.longitude === undefined) {
    return { skipped: false as const }
  }
  const latitude = input.latitude === undefined ? input.previous.latitude : input.latitude
  const longitude = input.longitude === undefined ? input.previous.longitude : input.longitude
  const changed = latitude !== input.previous.latitude || longitude !== input.previous.longitude
  const existing = changed ? null : await db.facts.liveSlot(input.subjectType, input.subjectId, 'coordinates', input.tx)
  const hasPoint = latitude != null && longitude != null
  if (!shouldWriteContact(changed, Boolean(existing), hasPoint ? 'point' : null)) {
    return { skipped: false as const }
  }
  const value = hasPoint ? { latitude, longitude } : null
  const blocked = await blockOwned(input, 'coordinates', value, input.tx)
  if (blocked) {
    return { skipped: true as const, conflict: blocked }
  }
  if (value) {
    await writeOwnedFact(input, 'coordinates', value, input.tx)
  } else {
    await retireFactSlot(input.subjectType, input.subjectId, 'coordinates', input.tx)
  }
  return { skipped: false as const }
}

/** Upsert the place visit-status fact. Same missing-fact rule as coordinates. */
export async function syncPlaceStatus(input: {
  placeId: string
  actor: FactActor
  pageStatus?: string | null
  status?: string | null
  previous: string
  /** When set, the fact write joins this save and rolls back with it. */
  tx?: ContentTx
}) {
  if (input.status === undefined || input.status === null) {
    return { skipped: false as const }
  }
  const changed = input.status !== input.previous
  const existing = changed ? null : await db.facts.liveSlot('place', input.placeId, 'status', input.tx)
  if (!shouldWriteContact(changed, Boolean(existing), input.status)) {
    return { skipped: false as const }
  }
  const value = { scope: 'place' as const, status: input.status }
  const blocked = await blockOwned(
    {
      subjectType: 'place',
      subjectId: input.placeId,
      actor: input.actor,
      pageStatus: input.pageStatus,
    },
    'status',
    value,
    input.tx,
  )
  if (blocked) {
    return { skipped: true as const, conflict: blocked }
  }
  await writeOwnedFact(
    {
      subjectType: 'place',
      subjectId: input.placeId,
      actor: input.actor,
      pageStatus: input.pageStatus,
    },
    'status',
    value,
    input.tx,
  )
  return { skipped: false as const }
}

/**
 * Mirror the official place phone as a `phone` fact (#238). The caller has
 * already checked the text and the source (`resolvePlaceContact`). Unlike a
 * venue, a place phone always carries the official URL it was read from, so
 * the source watcher can follow it. An unchanged claim writes nothing.
 */
export async function syncPlacePhone(input: {
  placeId: string
  actor: FactActor
  pageStatus?: string | null
  phone: string | null
  sourceUrl: string | null
  checkedAt: string | null
  /** When set, the fact write joins this save and rolls back with it. */
  tx?: ContentTx
}) {
  const existing = await db.facts.liveSlot('place', input.placeId, 'phone', input.tx)
  const target = {
    subjectType: 'place' as const,
    subjectId: input.placeId,
    actor: input.actor,
    pageStatus: input.pageStatus,
  }
  if (!input.phone) {
    if (!existing) {
      return { skipped: false as const }
    }
    const blocked = await blockOwned(target, 'phone', null, input.tx)
    if (blocked) {
      return { skipped: true as const, conflict: blocked }
    }
    await retireFactSlot('place', input.placeId, 'phone', input.tx)
    return { skipped: false as const }
  }
  const value = { text: input.phone }
  if (existing && existing.valueHash === valueHash(value) && (existing.sourceUrl ?? null) === input.sourceUrl) {
    return { skipped: false as const }
  }
  const queued = await commitFact(
    {
      kind: 'phone',
      subjectType: 'place',
      subjectId: input.placeId,
      slot: 'phone',
      value,
      sourceUrl: input.sourceUrl,
      sourceTitle: null,
      sourceKind: classifySourceUrl(input.sourceUrl),
      checkedAt: input.checkedAt,
      confidence: 'stated',
      actor: input.actor,
      refs: [{ consumerType: 'place', consumerId: input.placeId, path: 'short.phone' }],
      pageType: 'place',
      pageStatus: input.pageStatus ?? 'published',
    },
    input.tx,
  )
  return queued.conflict ? { skipped: true as const, conflict: queued.queueId } : { skipped: false as const }
}

async function contactChanged(
  input: {
    tx?: ContentTx
    venueId: string
    phone?: string | null
    address?: string | null
    previous: { phone: string | null; address: string | null }
  },
  slot: 'phone' | 'address',
) {
  const raw = input[slot]
  if (raw === undefined) {
    return false
  }
  const next = raw?.trim() || null
  const previous = input.previous[slot]?.trim() || null
  const changed = next !== previous
  if (changed) {
    return true
  }
  const existing = await db.facts.liveSlot('venue', input.venueId, slot, input.tx)
  return shouldWriteContact(false, Boolean(existing), next)
}

async function blockField(
  input: { venueId: string; actor: FactActor; pageStatus?: string | null; tx?: ContentTx },
  slot: 'phone' | 'address' | 'status',
  value: unknown,
) {
  return blockOwned(
    {
      subjectType: 'venue',
      subjectId: input.venueId,
      actor: input.actor,
      pageStatus: input.pageStatus,
    },
    slot,
    value,
    input.tx,
  )
}

async function blockOwned(
  input: {
    subjectType: 'place' | 'venue'
    subjectId: string
    actor: FactActor
    pageStatus?: string | null
  },
  slot: 'phone' | 'address' | 'status' | 'coordinates',
  value: unknown,
  tx?: ContentTx,
) {
  if (input.actor !== 'mcp') {
    return null
  }
  const existing = await db.facts.liveSlot(input.subjectType, input.subjectId, slot, tx)
  if (!existing) {
    return null
  }
  const latest = await db.facts.latestActor(existing.id, tx)
  const same = value != null && existing.valueHash === valueHash(value)
  if (!ownerBlocksToken(latest, same)) {
    return null
  }
  if (value == null) {
    const queued = await db.facts.enqueue(
      {
        target: 'fact',
        factId: existing.id,
        pageType: input.subjectType,
        entityId: input.subjectId,
        path: `short.${slot}`,
        reason: 'owner_conflict',
        proposal: { retire: true },
      },
      tx,
    )
    return queued.id
  }
  const queued = await commitFact(
    {
      kind: slot,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      slot,
      value,
      sourceUrl: null,
      sourceTitle: null,
      sourceKind: 'none',
      checkedAt: new Date().toISOString(),
      confidence: 'stated',
      actor: 'mcp',
      refs: [{ consumerType: input.subjectType, consumerId: input.subjectId, path: `short.${slot}` }],
      pageType: input.subjectType,
      pageStatus: input.pageStatus ?? 'published',
    },
    tx,
  )
  return queued.conflict ? queued.queueId : null
}

async function writeOwnedFact(
  input: {
    subjectType: 'place' | 'venue'
    subjectId: string
    actor: FactActor
    pageStatus?: string | null
  },
  slot: 'coordinates' | 'status',
  value: unknown,
  tx?: ContentTx,
) {
  const owner = input.actor === 'owner'
  await commitFact(
    {
      kind: slot,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      slot,
      value,
      sourceUrl: null,
      sourceTitle: null,
      sourceKind: owner ? 'owner' : 'none',
      checkedAt: new Date().toISOString(),
      ttlDays: defaultTtl(slot),
      confidence: owner ? 'owner' : 'stated',
      actor: input.actor,
      refs: [{ consumerType: input.subjectType, consumerId: input.subjectId, path: `short.${slot}` }],
      pageType: input.subjectType,
      pageStatus: input.pageStatus ?? 'published',
      markUnseeded: !owner,
    },
    tx,
  )
}

async function writeContact(
  input: { venueId: string; actor: FactActor; pageStatus?: string | null; tx?: ContentTx },
  slot: 'phone' | 'address' | 'status',
  value: unknown,
) {
  const owner = input.actor === 'owner'
  await commitFact(
    {
      kind: slot,
      subjectType: 'venue',
      subjectId: input.venueId,
      slot,
      value,
      sourceUrl: null,
      sourceTitle: null,
      sourceKind: owner ? 'owner' : 'none',
      checkedAt: new Date().toISOString(),
      ttlDays: defaultTtl(slot),
      confidence: owner ? 'owner' : 'stated',
      actor: input.actor,
      refs: [{ consumerType: 'venue', consumerId: input.venueId, path: `short.${slot}` }],
      pageType: 'venue',
      pageStatus: input.pageStatus ?? 'published',
      markUnseeded: !owner,
    },
    input.tx,
  )
}

function priceKey(item: string, variant?: string | null) {
  return `${item.trim().toLowerCase()}:${variant?.trim() || ''}`
}

function dateStamp(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : new Date(value).toISOString()
}
