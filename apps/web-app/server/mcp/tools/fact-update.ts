import { db } from '@k39/database'
import { z } from 'zod'
import { CONFIDENCE, SOURCE_KINDS } from '../../../shared/facts'
import { commitFact } from '../../utils/facts/commit'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'fact_update',
  description: 'Replace one fact after the kind schema accepts the value. Writes a revision and closes that fact\'s queue rows. Does not change publication and does not mark prose reviewed. sourceUrl must not name a banned site. If the latest revision actor is owner, the value is not written: the conflict waits for an editor in /admin. Writes an mcp_audits row.',
  inputSchema: {
    id: z.string(),
    value: z.unknown(),
    sourceUrl: z.string().url().nullable().optional(),
    sourceTitle: z.string().nullable().optional(),
    sourceKind: z.enum(SOURCE_KINDS),
    confidence: z.enum(CONFIDENCE),
    checkedAt: z.string().nullable().optional(),
    ttlDays: z.number().int().positive().optional(),
  },
  handler: async (input) => {
    const current = await db.facts.byId(input.id)
    if (!current || current.retiredAt) {
      throw createError({ statusCode: 404, statusMessage: 'Факт не найден' })
    }
    const refs = await db.facts.refsFor(current.id)
    const result = await commitFact({
      kind: current.kind as 'hours',
      subjectType: current.subjectType as 'place',
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
    await auditMcp('fact_update', 'fact', current.id)
    if (result.conflict) {
      return { updated: false, conflict: true, queueId: result.queueId, factId: current.id }
    }
    return { updated: true, conflict: false, fact: result.fact }
  },
})
