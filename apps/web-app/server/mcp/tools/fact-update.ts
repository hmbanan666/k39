import { z } from 'zod'
import { CONFIDENCE, SOURCE_KINDS } from '../../../shared/facts'
import { auditMcp } from '../../utils/mcp/audit'
import { updateFact } from '../../utils/mcp/fact-write'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'fact_update',
  description: 'Replace one fact after the kind schema accepts the value. Writes a revision and closes that fact\'s queue rows. Does not change publication and does not mark prose reviewed. sourceUrl must not name a banned site. If the latest revision actor is owner, the value is not written: the conflict waits for an editor in /admin. A draft token cannot change a fact whose parent is live: a published or archived place or route, a stop on that route, a region, a published or closed venue, or a subject type this writer does not resolve. That answer is 409 and the live page stays. Writes an mcp_audits row.',
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
    const result = await updateFact(input)
    await auditMcp('fact_update', 'fact', input.id)
    if (result.conflict) {
      return { updated: false, conflict: true, queueId: result.queueId, factId: input.id }
    }
    return { updated: true, conflict: false, fact: result.fact }
  },
})
