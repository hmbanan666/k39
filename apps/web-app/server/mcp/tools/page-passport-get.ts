import { z } from 'zod'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { auditedScore, readPassport, resolveScoredPage } from '../../utils/scoring/run'
import { pageKindSchema } from '../../utils/scoring/schemas'

export default defineStrictMcpTool({
  name: 'page_passport_get',
  description: 'Read the page passport for a place, route, collection, hub, quest, or venue. Pass a path, or pageType plus slug. Returns empty fields when the passport has not been filled in, including lengthOverride.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    path: z.string().optional(),
    pageType: pageKindSchema.optional(),
    slug: z.string().optional(),
  },
  handler: async (input) => auditedScore('page_passport_get', input.path || input.slug || null, async () => {
    const page = await resolveScoredPage(input)
    if (!page) {
      throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
    }
    return readPassport(page)
  }),
})
