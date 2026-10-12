import { z } from 'zod'
import { auditedScore, readPassport, resolveScoredPage } from '../../utils/scoring/run'
import { pageKindSchema } from '../../utils/scoring/schemas'

export default defineMcpTool({
  name: 'page_passport_get',
  description: 'Read the page passport for a place, route, collection, hub, or quest. Pass a path, or pageType plus slug. Returns empty fields when the passport has not been filled in.',
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
