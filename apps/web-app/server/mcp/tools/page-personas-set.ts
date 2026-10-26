import { db } from '@k39/database'
import { z } from 'zod'
import { orderPagePersonas, pagePersonasSchema } from '../../../shared/personas'
import { auditMcp } from '../../utils/mcp/audit'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { resolveScoredPage } from '../../utils/scoring/run'
import { pageKindSchema } from '../../utils/scoring/schemas'

export default defineStrictMcpTool({
  name: 'page_personas_set',
  description:
    'Replace the target personas of a page (path, or pageType and slug). personas is [{code, weight 1..3, primary}] with codes from personas_list and exactly one primary. An empty array clears the list. Does not change what the page shows.',
  inputSchema: {
    path: z.string().optional(),
    pageType: pageKindSchema.optional(),
    slug: z.string().optional(),
    personas: pagePersonasSchema,
  },
  handler: async (input) => {
    const page = await resolveScoredPage(input)
    if (!page) {
      throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
    }
    const rows = await db.scoring.setPagePersonas(page.pageType, page.entityId, input.personas)
    await auditMcp('page_personas_set', page.pageType, page.entityId)
    return {
      path: page.path,
      pageType: page.pageType,
      personas: orderPagePersonas(rows).map((row) => ({
        code: row.personaCode,
        weight: row.weight,
        primary: row.primary,
      })),
    }
  },
})
