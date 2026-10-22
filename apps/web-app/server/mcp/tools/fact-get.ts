import { db } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'fact_get',
  description: 'One fact, the pages that cite it, and the latest revisions. Writes an mcp_audits row.',
  inputSchema: {
    id: z.string(),
  },
  handler: async ({ id }) => {
    const fact = await db.facts.byId(id)
    if (!fact || fact.retiredAt) {
      throw createError({ statusCode: 404, statusMessage: 'Факт не найден' })
    }
    const [refs, revisions] = await Promise.all([db.facts.refsFor(id), db.facts.revisions(id)])
    await auditMcp('fact_get', 'fact', id)
    return { fact, refs, revisions }
  },
})
