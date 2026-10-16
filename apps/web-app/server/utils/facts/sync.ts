import type { VenuePriceInput } from '@k39/database'
import type { FactActor } from '../../../shared/facts'
import type { ScheduleRecord, ScheduleRules } from '../../../shared/schedule'
import { db } from '@k39/database'
import { classifySourceUrl, defaultTtl, hoursLookEmpty, ownerBlocksToken, valueHash } from '../../../shared/facts'
import { readRules } from '../../../shared/schedule'
import { commitFact, retireFactSlot } from './commit'

export async function hoursConflict(entityType: 'place' | 'venue', entityId: string, record: ScheduleRecord, actor: FactActor) {
  if (actor !== 'mcp') {
    return null
  }
  const rules = readRules(record.rules)
  if (!rules) {
    return null
  }
  const existing = await db.facts.liveSlot(entityType, entityId, 'hours')
  if (!existing) {
    return null
  }
  const latest = await db.facts.latestActor(existing.id)
  const next = hoursClaim(rules, record)
  const same = existing.valueHash === valueHash(next.value)
    && existing.sourceKind === next.sourceKind
    && (existing.sourceUrl ?? null) === next.sourceUrl
    && existing.confidence === next.confidence
  if (!ownerBlocksToken(latest, same)) {
    return null
  }
  const queued = await commitFact({
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
  })
  return queued.conflict ? queued : null
}

export async function writeHoursFact(entityType: 'place' | 'venue', entityId: string, record: ScheduleRecord, actor: FactActor, pageStatus?: string | null) {
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
  }
  await commitFact({
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
  })
}

function hoursClaim(rules: ScheduleRules, record: ScheduleRecord): {
  value: ScheduleRules
  sourceUrl: string | null
  sourceTitle: string | null
  sourceKind: 'official' | 'official_social' | 'map_yandex' | 'map_2gis' | 'osm' | 'owner' | 'none'
  checkedAt: string | null
  confidence: 'stated' | 'owner' | 'gap'
} {
  const empty = hoursLookEmpty(rules)
  const unchecked = empty || !record.verifiedAt || rules.needsCheck
  const sourceKind = empty || !record.sourceUrl ? 'none' as const : classifySourceUrl(record.sourceUrl)
  return {
    value: rules,
    sourceUrl: sourceKind === 'none' ? null : record.sourceUrl,
    sourceTitle: null,
    sourceKind,
    checkedAt: unchecked || !record.verifiedAt ? null : `${record.verifiedAt.slice(0, 10)}T00:00:00.000Z`,
    confidence: empty || sourceKind === 'none' ? 'gap' as const : 'stated' as const,
  }
}

export async function setVenuePrices(venueId: string, prices: VenuePriceInput[], actor: FactActor, pageStatus?: string | null) {
  const catalog = new Map((await db.prices.items()).map((item) => [item.slug, item]))
  const current = await db.prices.forVenue(venueId)
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
    const existing = await db.facts.liveSlot('venue', venueId, `price:${item.id}:${row.variant}`)
    const latest = existing ? await db.facts.latestActor(existing.id) : null
    const same = Boolean(next && next.priceRub === row.priceRub && next.sourceKind === row.sourceKind && (next.sourceUrl ?? null) === row.sourceUrl)
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
        const queued = await commitFact({
          kind: 'price',
          subjectType: 'venue',
          subjectId: venueId,
          slot: `price:${item.id}:${row.variant}`,
          value: { itemId: item.id, itemSlug: item.slug, variant: row.variant, priceRub: Math.round(next.priceRub) },
          sourceUrl: next.sourceKind === 'owner' ? null : next.sourceUrl ?? null,
          sourceTitle: next.sourceTitle,
          sourceKind: next.sourceKind === 'owner' ? 'owner' : classifySourceUrl(next.sourceUrl),
          checkedAt: dateStamp(next.checkedAt),
          confidence: next.sourceKind === 'owner' ? 'owner' : 'stated',
          actor,
          refs: [{ consumerType: 'venue', consumerId: venueId, path: 'modules.prices' }],
          pageType: 'venue',
          pageStatus: pageStatus ?? 'published',
        })
        if (queued.conflict) {
          conflicts.push(queued.queueId)
        }
      } else if (existing) {
        const queued = await db.facts.enqueue({
          target: 'fact',
          factId: existing.id,
          pageType: 'venue',
          entityId: venueId,
          path: 'modules.prices',
          reason: 'owner_conflict',
          proposal: { retire: true },
        })
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

  const saved = await db.prices.setForVenue(venueId, final)
  const savedKeys = new Set(saved.map((row) => priceKey(row.item, row.variant)))
  for (const row of current) {
    if (!savedKeys.has(priceKey(row.item, row.variant))) {
      const item = catalog.get(row.item)
      if (item) {
        await retireFactSlot('venue', venueId, `price:${item.id}:${row.variant}`)
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
    const keptOwner = kept.has(priceKey(row.item, row.variant)) && actor === 'mcp' && conflicts.length
      ? current.find((itemRow) => priceKey(itemRow.item, itemRow.variant) === priceKey(row.item, row.variant))
      : null
    const writeActor: FactActor = keptOwner && keptOwner.priceRub === row.priceRub ? 'owner' : actor
    const sourceKind = row.sourceKind === 'owner' ? 'owner' as const : classifySourceUrl(row.sourceUrl)
    await commitFact({
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
    })
  }
  return { prices: saved, conflicts }
}

export async function syncVenueContact(input: {
  venueId: string
  actor: FactActor
  pageStatus?: string | null
  phone?: string | null
  address?: string | null
  status?: string | null
  previous: { phone: string | null, address: string | null, status: string }
}) {
  const conflicts: string[] = []
  const skipped = { phone: false, address: false, status: false }
  if (input.phone !== undefined && input.phone !== input.previous.phone) {
    const blocked = await blockField(input, 'phone', input.phone ? { text: input.phone.trim() } : null)
    if (blocked) {
      skipped.phone = true
      conflicts.push(blocked)
    } else if (input.phone?.trim()) {
      await writeContact(input, 'phone', { text: input.phone.trim() })
    } else {
      await retireFactSlot('venue', input.venueId, 'phone')
    }
  }
  if (input.address !== undefined && input.address !== input.previous.address) {
    const blocked = await blockField(input, 'address', input.address ? { text: input.address.trim() } : null)
    if (blocked) {
      skipped.address = true
      conflicts.push(blocked)
    } else if (input.address?.trim()) {
      await writeContact(input, 'address', { text: input.address.trim() })
    } else {
      await retireFactSlot('venue', input.venueId, 'address')
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
      await retireFactSlot('venue', input.venueId, 'status')
    }
  }
  return { conflicts, skipped }
}

async function blockField(input: { venueId: string, actor: FactActor, pageStatus?: string | null }, slot: 'phone' | 'address' | 'status', value: unknown) {
  if (input.actor !== 'mcp') {
    return null
  }
  const existing = await db.facts.liveSlot('venue', input.venueId, slot)
  if (!existing) {
    return null
  }
  const latest = await db.facts.latestActor(existing.id)
  const same = value != null && existing.valueHash === valueHash(value)
  if (!ownerBlocksToken(latest, same)) {
    return null
  }
  if (value == null) {
    const queued = await db.facts.enqueue({
      target: 'fact',
      factId: existing.id,
      pageType: 'venue',
      entityId: input.venueId,
      path: `short.${slot}`,
      reason: 'owner_conflict',
      proposal: { retire: true },
    })
    return queued.id
  }
  const queued = await commitFact({
    kind: slot,
    subjectType: 'venue',
    subjectId: input.venueId,
    slot,
    value,
    sourceUrl: null,
    sourceTitle: null,
    sourceKind: 'none',
    checkedAt: new Date().toISOString(),
    confidence: 'stated',
    actor: 'mcp',
    refs: [{ consumerType: 'venue', consumerId: input.venueId, path: `short.${slot}` }],
    pageType: 'venue',
    pageStatus: input.pageStatus ?? 'published',
  })
  return queued.conflict ? queued.queueId : null
}

async function writeContact(input: { venueId: string, actor: FactActor, pageStatus?: string | null }, slot: 'phone' | 'address' | 'status', value: unknown) {
  const owner = input.actor === 'owner'
  await commitFact({
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
  })
}

function priceKey(item: string, variant?: string | null) {
  return `${item.trim().toLowerCase()}:${variant?.trim() || ''}`
}

function dateStamp(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : new Date(value).toISOString()
}
