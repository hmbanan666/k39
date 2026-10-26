import type { ContentTx, FactRefWrite } from '@k39/database'
import type { FactActor, FactConfidence, FactKind, FactProposal, FactSubject, SourceKind } from '../../../shared/facts'
import { db } from '@k39/database'
import { createError } from 'h3'
import {
  defaultTtl,
  mapSourceAllowed,
  ownerBlocksToken,
  parseFactValue,
  priorityFor,
  queueMayOpen,
  valueHash,
  watchableSource,
} from '../../../shared/facts'
import { rejectBannedSites } from '../mcp/writing-guard'

export interface CommitFactInput {
  kind: FactKind
  subjectType: FactSubject
  subjectId: string
  slot: string
  value: unknown
  sourceUrl: string | null
  sourceTitle: string | null
  sourceKind: SourceKind
  checkedAt: string | null
  ttlDays?: number
  confidence: FactConfidence
  actor: FactActor
  refs: FactRefWrite[]
  /** Publication status of the page that shows this fact. Null for a hub. */
  pageStatus?: string | null
  pageType?: string | null
  /** A copied field with no citation still needs a person, even when a date was stored. */
  markUnseeded?: boolean
}

export async function commitFact(input: CommitFactInput, tx?: ContentTx) {
  rejectBannedSites({ sourceUrl: input.sourceUrl, sourceTitle: input.sourceTitle })
  if (!mapSourceAllowed(input.subjectType, input.kind, input.sourceKind)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Карта подходит только заведению и только для адреса, часов, телефона, статуса и координат',
    })
  }
  const value = parseFactValue(input.kind, input.value)
  if (!value) {
    throw createError({ statusCode: 400, statusMessage: 'Значение факта не подходит к его типу' })
  }
  const hash = valueHash(value)
  const ttlDays = input.ttlDays ?? defaultTtl(input.kind)
  const existing = await db.facts.liveSlot(input.subjectType, input.subjectId, input.slot, tx)
  const proposal: FactProposal = {
    value,
    sourceUrl: input.sourceUrl,
    sourceTitle: input.sourceTitle,
    sourceKind: input.sourceKind,
    confidence: input.confidence,
    ttlDays,
    checkedAt: input.checkedAt,
  }
  if (existing && input.actor === 'mcp') {
    const actor = await db.facts.latestActor(existing.id, tx)
    const same =
      existing.valueHash === hash &&
      existing.sourceKind === input.sourceKind &&
      (existing.sourceUrl ?? null) === input.sourceUrl &&
      existing.confidence === input.confidence
    if (ownerBlocksToken(actor, same)) {
      const queued = await db.facts.enqueue(
        {
          target: 'fact',
          factId: existing.id,
          pageType: input.pageType ?? input.subjectType,
          entityId: input.subjectId,
          path: input.refs[0]?.path ?? input.slot,
          reason: 'owner_conflict',
          priority: priorityFor(input.kind, 'owner_conflict', 1),
          proposal: {
            value: proposal.value,
            sourceUrl: proposal.sourceUrl,
            sourceTitle: proposal.sourceTitle,
            sourceKind: proposal.sourceKind,
            confidence: proposal.confidence,
            ttlDays: proposal.ttlDays,
            checkedAt: proposal.checkedAt,
          },
        },
        tx,
      )
      return { conflict: true as const, queueId: queued.id, fact: existing }
    }
  }
  const { fact } = await db.facts.upsert(
    {
      kind: input.kind,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      slot: input.slot,
      value,
      valueHash: hash,
      sourceUrl: input.sourceUrl,
      sourceTitle: input.sourceTitle,
      sourceKind: input.sourceKind,
      checkedAt: input.checkedAt,
      ttlDays,
      confidence: input.confidence,
      actor: input.actor,
    },
    input.refs,
    tx,
  )
  if (input.sourceUrl && watchableSource(input.sourceKind, input.sourceUrl)) {
    const base = input.checkedAt ? new Date(input.checkedAt).getTime() : Date.now()
    await db.facts.ensureSource(input.sourceUrl, new Date(base + ttlDays * 86_400_000).toISOString(), tx)
  }
  if (input.checkedAt) {
    await db.facts.closeForFact(fact.id, tx)
  }
  if ((!input.checkedAt || input.markUnseeded) && queueMayOpen(input.pageStatus ?? null, 'unseeded')) {
    await db.facts.enqueue(
      {
        target: 'fact',
        factId: fact.id,
        pageType: input.pageType ?? input.subjectType,
        entityId: input.subjectId,
        path: input.refs[0]?.path ?? input.slot,
        reason: 'unseeded',
        priority: priorityFor(input.kind, 'unseeded', 1),
      },
      tx,
    )
  }
  return { conflict: false as const, fact }
}

export async function retireFactSlot(subjectType: FactSubject, subjectId: string, slot: string, tx?: ContentTx) {
  await db.facts.retireSlot(subjectType, subjectId, slot, tx)
}
