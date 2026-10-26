import { z } from 'zod'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { auditedScore, listContentScores } from '../../utils/scoring/run'
import { pageKindSchema, scoreBlockSchema } from '../../utils/scoring/schemas'

export default defineStrictMcpTool({
  name: 'content_scores_list',
  description:
    'List page scores. Filter by pageType, by a block (quality, linking, indexing, results), and by below (that block, or the total when block is omitted). Sort by total, a block, title, or path.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    pageType: pageKindSchema.optional(),
    block: scoreBlockSchema.optional(),
    below: z.number().int().min(0).max(100).optional(),
    sort: z.enum(['total', 'quality', 'linking', 'indexing', 'results', 'title', 'path']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  },
  handler: async (input) =>
    auditedScore('content_scores_list', null, async () => {
      const rows = await listContentScores(input)
      return { count: rows.length, rows }
    }),
})
