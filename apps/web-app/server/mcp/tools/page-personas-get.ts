import { db } from '@k39/database'
import { z } from 'zod'
import { orderPagePersonas } from '../../../shared/personas'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { resolveScoredPage } from '../../utils/scoring/run'
import { pageKindSchema } from '../../utils/scoring/schemas'

export default defineStrictMcpTool({
  name: 'page_personas_get',
  description: 'Read the target personas of a page by path, or by pageType and slug: code, weight 1..3 and the primary flag.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    path: z.string().optional(),
    pageType: pageKindSchema.optional(),
    slug: z.string().optional(),
  },
  handler: async (input) => {
    const page = await resolveScoredPage(input)
    if (!page) {
      throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
    }
    const rows = orderPagePersonas(await db.scoring.pagePersonas(page.pageType, page.entityId))
    return {
      path: page.path,
      pageType: page.pageType,
      title: page.title,
      personas: rows.map((row) => ({ code: row.personaCode, weight: row.weight, primary: row.primary })),
    }
  },
})
