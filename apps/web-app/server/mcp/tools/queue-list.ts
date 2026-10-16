import { db } from '@k39/database'
import { z } from 'zod'
import { PHASE1_KINDS, QUEUE_REASONS } from '../../../shared/facts'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'queue_list',
  description: 'The verification queue (ADR 0033). Start here. Do not scan places_list to re-check fresh facts. Filters: kind, reason, minPriority. limit defaults to 20 and stops at 50. claim true locks the returned rows for 30 minutes. Writes an mcp_audits row.',
  inputSchema: {
    kind: z.enum(PHASE1_KINDS).optional(),
    reason: z.enum(QUEUE_REASONS).optional(),
    minPriority: z.number().int().optional(),
    limit: z.number().int().min(1).max(50).default(20),
    claim: z.boolean().optional(),
  },
  handler: async ({ kind, reason, minPriority, limit, claim }) => {
    const rows = await db.facts.listQueue({ kind, reason, minPriority, limit, claim, lockedBy: 'mcp' })
    await auditMcp('queue_list', 'queue', null)
    return {
      rows: rows.map((row) => ({
        id: row.id,
        target: row.target,
        factId: row.factId,
        pageType: row.pageType,
        entityId: row.entityId,
        path: row.path,
        reason: row.reason,
        priority: row.priority,
        enqueuedAt: row.enqueuedAt,
        lockedUntil: claim ? row.lockedUntil : null,
      })),
    }
  },
})
