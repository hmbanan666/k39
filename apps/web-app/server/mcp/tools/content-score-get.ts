import { z } from 'zod'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { auditedScore, getContentScore, normalizePath, refreshContentScores } from '../../utils/scoring/run'

export default defineStrictMcpTool({
  name: 'content_score_get',
  description:
    'The stored score of one published page, with the failing checks in each block. refresh true recomputes every page and writes content_scores, then returns this path. A draft, a review page, or a pending payload is not stored: content_score_preview scores those without writing.',
  inputSchema: {
    path: z.string(),
    refresh: z.boolean().optional(),
  },
  handler: async ({ path, refresh }) =>
    auditedScore('content_score_get', path, async () => {
      if (refresh) {
        await refreshContentScores({ force: true })
      }
      const row = await getContentScore(normalizePath(path))
      if (!row) {
        throw createError({ statusCode: 404, statusMessage: 'Оценка не найдена' })
      }
      return row
    }),
})
