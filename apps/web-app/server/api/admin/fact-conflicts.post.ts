import { db } from '@k39/database'
import { z } from 'zod'
import { requireEditor } from '../../utils/access'
import { commitFact } from '../../utils/facts/commit'

const bodySchema = z.object({
  id: z.string(),
  action: z.enum(['apply', 'dismiss']),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = bodySchema.parse(await readJsonBody(event))
  const row = await db.facts.queueById(body.id)
  if (!row || row.resolvedAt || row.reason !== 'owner_conflict' || !row.factId) {
    throw createError({ statusCode: 404, statusMessage: 'Конфликт не найден' })
  }
  if (body.action === 'dismiss') {
    await db.facts.close(row.id)
    return { ok: true, action: 'dismiss' }
  }
  const fact = await db.facts.byId(row.factId)
  if (!fact) {
    throw createError({ statusCode: 404, statusMessage: 'Факт не найден' })
  }
  const proposal = row.proposal
  if (proposal && proposal.retire === true) {
    await db.facts.retire(fact.id)
    await db.facts.close(row.id)
    return { ok: true, action: 'apply' }
  }
  if (!proposal || !('value' in proposal)) {
    throw createError({ statusCode: 400, statusMessage: 'В конфликте нет предлагаемого значения' })
  }
  const refs = await db.facts.refsFor(fact.id)
  await commitFact({
    kind: fact.kind as 'phone',
    subjectType: fact.subjectType as 'venue',
    subjectId: fact.subjectId,
    slot: fact.slot,
    value: proposal.value,
    sourceUrl: typeof proposal.sourceUrl === 'string' ? proposal.sourceUrl : null,
    sourceTitle: typeof proposal.sourceTitle === 'string' ? proposal.sourceTitle : null,
    sourceKind: typeof proposal.sourceKind === 'string' ? proposal.sourceKind as 'official' : 'none',
    checkedAt: typeof proposal.checkedAt === 'string' ? proposal.checkedAt : new Date().toISOString(),
    ttlDays: typeof proposal.ttlDays === 'number' ? proposal.ttlDays : undefined,
    confidence: proposal.confidence === 'owner' || proposal.confidence === 'gap' ? proposal.confidence : 'stated',
    actor: 'editor',
    refs: refs.map((ref) => ({ consumerType: ref.consumerType, consumerId: ref.consumerId, path: ref.path })),
    pageType: fact.subjectType,
    pageStatus: 'published',
  })
  await db.facts.close(row.id)
  return { ok: true, action: 'apply' }
})
