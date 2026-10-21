import { z } from 'zod'
import { mcpStrictInput } from '../../utils/mcp/venues'
import { auditedScore, normalizePath, previewContentScore } from '../../utils/scoring/run'

const contentScorePreviewInput = z.strictObject({
  path: z.string().describe('Page path, such as /fort-11 or /zavedeniya/cafe-slug.'),
})

export default defineMcpTool({
  name: 'content_score_preview',
  description: 'Score one page on demand without writing content_scores. A draft or review row is scored from that row. A place with a pending payload (content_drafts) is scored from that payload, and the live page stays. A published page with no pending payload is scored from the live row. The response has preview true and source live, draft, or pending. Traffic results are not applicable for a draft row or a pending payload. Stored scores and /admin are unchanged. content_score_get still reads the stored score. There is no refresh argument; unknown keys are rejected.',
  annotations: { readOnlyHint: true },
  inputSchema: mcpStrictInput(contentScorePreviewInput),
  handler: async (input) => {
    const { path } = contentScorePreviewInput.parse(input)
    return auditedScore('content_score_preview', path, async () => {
      const row = await previewContentScore(normalizePath(path))
      if (!row) {
        throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
      }
      return row
    })
  },
})
