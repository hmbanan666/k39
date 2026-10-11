import { db } from '@k39/database'
import { z } from 'zod'
import { slugError } from '../../../shared/seo'
import { auditMcp } from '../../utils/mcp/audit'
import { normalizePublication } from '../../utils/mcp/draft'

export default defineMcpTool({
  name: 'quest_save',
  description: 'Create or update a quest in place. Omitting publicationStatus leaves a published quest published. Optional steps replace the existing steps. A slug rename writes a 301 from /kvesty/old.',
  inputSchema: {
    id: z.string().optional(),
    slug: z.string(),
    title: z.string(),
    summary: z.string().nullable().optional(),
    body: z.string().optional(),
    publicationStatus: z.enum(['draft', 'review', 'published']).optional(),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
    ogImage: z.string().nullable().optional(),
    noindex: z.boolean().optional(),
    routeSlug: z.string().nullable().optional(),
    steps: z.array(z.object({
      placeSlug: z.string(),
      title: z.string(),
      prompt: z.string().nullable().optional(),
    })).optional(),
  },
  handler: async (input) => {
    const problem = slugError(input.slug)
    if (problem) {
      throw createError({ statusCode: 400, statusMessage: problem })
    }
    const current = input.id ? await db.editor.questById(input.id) : await db.editor.questBySlug(input.slug)
    let routeId: string | null | undefined
    if (input.routeSlug === null) {
      routeId = null
    } else if (input.routeSlug) {
      const route = (await db.editor.listRoutes()).find((item) => item.slug === input.routeSlug)
      if (!route) {
        throw createError({ statusCode: 400, statusMessage: 'Маршрут не найден' })
      }
      routeId = route.id
    }
    try {
      const row = await db.editor.saveQuest({
        id: current?.id,
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        body: input.body,
        publicationStatus: normalizePublication(input.publicationStatus, current?.publicationStatus),
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        ogImage: input.ogImage,
        noindex: input.noindex,
        routeId,
        steps: input.steps,
      })
      await auditMcp('quest_save', 'quest', row.id)
      return { id: row.id, slug: row.slug, title: row.title, publicationStatus: row.publicationStatus }
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message.startsWith('Place not found')) {
        throw createError({ statusCode: 400, statusMessage: message })
      }
      throw error
    }
  },
})
