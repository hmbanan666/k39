import type { AdmissionValue, EventValue, FactConfidence, FactKind, FactSubject, SourceKind } from '../../../shared/facts'
import type { PracticalSubjectType } from '../practical/target'
import { db } from '@k39/database'
import { createError } from 'h3'
import { parseFactValue } from '../../../shared/facts'
import { commitFact } from '../facts/commit'
import { updateAdmissionFact } from '../practical/admission'
import { updateEventFact } from '../practical/events'
import { practicalTarget } from '../practical/target'
import { refuseDraftLivePage } from './draft'

/**
 * A draft token must not change a fact whose parent is live.
 * Place and venue use their own statuses. A route stop follows its route.
 * A region has no status: a row that exists is live. Any other subject is
 * treated as live, because this writer has no parent to prove otherwise.
 * A missing place, venue, route, stop, or region is left to the fact writer.
 */
export async function refuseLiveFact(subjectType: string, subjectId: string) {
  if (subjectType === 'place') {
    const place = await db.editor.placeById(subjectId)
    refuseDraftLivePage('edit a fact on a published place', place?.publicationStatus)
    return
  }
  if (subjectType === 'venue') {
    const venue = await db.venues.byId(subjectId)
    refuseDraftLivePage('edit a fact on a published venue', venue?.status, ['published', 'closed'])
    return
  }
  if (subjectType === 'route') {
    const route = await db.editor.routeById(subjectId)
    refuseDraftLivePage('edit a fact on a published route', route?.publicationStatus)
    return
  }
  if (subjectType === 'route_stop') {
    const route = await db.editor.routeForPoint(subjectId)
    refuseDraftLivePage('edit a fact on a published route', route?.publicationStatus)
    return
  }
  if (subjectType === 'region') {
    const region = await db.editor.regionById(subjectId)
    refuseDraftLivePage('edit a fact on a published region', region ? 'published' : undefined)
    return
  }
  refuseDraftLivePage('edit a fact on a live subject', 'published')
}

/** Admission and event facts sit beside a row. The row writer keeps both in step. */
async function updatePracticalFact(current: { kind: string, subjectType: string, subjectId: string, slot: string }, input: { value: unknown, sourceUrl?: string | null, sourceTitle?: string | null, checkedAt?: string | null }) {
  const value = parseFactValue(current.kind, input.value)
  if (!value) {
    throw createError({ statusCode: 400, statusMessage: 'Значение факта не подходит к его типу' })
  }
  const target = await practicalTarget(current.subjectType as PracticalSubjectType, current.subjectId)
  const source = { sourceUrl: input.sourceUrl ?? null, sourceTitle: input.sourceTitle ?? null, checkedAt: input.checkedAt ?? null }
  const conflicts = current.kind === 'admission'
    ? (await updateAdmissionFact(target, current.slot, value as AdmissionValue, source)).ownerConflicts
    : [(await updateEventFact(target, current.slot, value as EventValue, source)).ownerConflict].filter((id): id is string => Boolean(id))
  const fact = await db.facts.liveSlot(current.subjectType, current.subjectId, current.slot)
  if (conflicts[0] && fact) {
    return { conflict: true as const, queueId: conflicts[0], fact }
  }
  return { conflict: false as const, fact: fact! }
}

export async function updateFact(input: {
  id: string
  value: unknown
  sourceUrl?: string | null
  sourceTitle?: string | null
  sourceKind: SourceKind
  confidence: FactConfidence
  checkedAt?: string | null
  ttlDays?: number
}) {
  const current = await db.facts.byId(input.id)
  if (!current || current.retiredAt) {
    throw createError({ statusCode: 404, statusMessage: 'Факт не найден' })
  }
  await refuseLiveFact(current.subjectType, current.subjectId)
  if (current.kind === 'admission' || current.kind === 'event') {
    return updatePracticalFact(current, input)
  }
  const refs = await db.facts.refsFor(current.id)
  return commitFact({
    kind: current.kind as FactKind,
    subjectType: current.subjectType as FactSubject,
    subjectId: current.subjectId,
    slot: current.slot,
    value: input.value,
    sourceUrl: input.confidence === 'owner' || input.sourceKind === 'owner' || input.sourceKind === 'none' ? null : input.sourceUrl ?? null,
    sourceTitle: input.sourceTitle ?? null,
    sourceKind: input.confidence === 'owner' ? 'owner' : input.sourceKind,
    checkedAt: input.checkedAt === undefined ? new Date().toISOString() : input.checkedAt,
    ttlDays: input.ttlDays,
    confidence: input.confidence,
    actor: 'mcp',
    refs: refs.map((ref) => ({ consumerType: ref.consumerType, consumerId: ref.consumerId, path: ref.path })),
    pageType: current.subjectType,
    pageStatus: 'published',
  })
}
