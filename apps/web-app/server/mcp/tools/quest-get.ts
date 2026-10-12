import { db } from '@k39/database'
import { z } from 'zod'
import { routeSlugOf } from '../../utils/mcp/quests'

export default defineMcpTool({
  name: 'quest_get',
  description: 'Load one quest by id or slug, including drafts, steps, and routeSlug. routeSlug is null when the quest is not linked to a route.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async ({ id, slug }) => {
    const quest = id ? await db.editor.questById(id) : slug ? await db.editor.questBySlug(slug) : null
    if (!quest) {
      throw createError({ statusCode: 404, statusMessage: 'Квест не найден' })
    }
    const routes = await db.editor.listRoutes()
    return {
      id: quest.id,
      slug: quest.slug,
      title: quest.title,
      summary: quest.summary,
      body: quest.body,
      publicationStatus: quest.publicationStatus,
      seoTitle: quest.seoTitle,
      seoDescription: quest.seoDescription,
      noindex: quest.noindex,
      routeSlug: routeSlugOf(quest.routeId, routes),
      steps: await db.editor.questStepsFor(quest.id),
    }
  },
})
