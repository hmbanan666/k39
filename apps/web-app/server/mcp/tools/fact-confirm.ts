import { db } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'fact_confirm',
  description: 'Confirm the value hash you read. A mismatch is rejected. The same hash moves checked_at, closes that fact\'s queue rows, and writes no revision. Writes an mcp_audits row.',
  inputSchema: {
    id: z.string(),
    valueHash: z.string().min(64).max(64),
  },
  handler: async ({ id, valueHash }) => {
    const result = await db.facts.confirm(id, valueHash, new Date().toISOString())
    await auditMcp('fact_confirm', 'fact', id)
    if (!result.ok && result.reason === 'missing') {
      throw createError({ statusCode: 404, statusMessage: 'Факт не найден' })
    }
    if (!result.ok) {
      throw createError({ statusCode: 409, statusMessage: 'Хеш факта не совпадает' })
    }
    return { confirmed: true, fact: result.fact }
  },
})
