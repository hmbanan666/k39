import { z } from 'zod'
import { auditedScore, getContentScore, normalizePath, refreshContentScores } from '../../utils/scoring/run'

export default defineMcpTool({
  name: 'content_score_get',
  description: 'One page score with the failing checks in each block. refresh true recomputes every page first, then returns this path.',
  inputSchema: {
    path: z.string(),
    refresh: z.boolean().optional(),
  },
  handler: async ({ path, refresh }) => auditedScore('content_score_get', path, async () => {
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
