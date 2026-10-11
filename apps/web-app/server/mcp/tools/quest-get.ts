import { db } from '@k39/database'
import { z } from 'zod'

export default defineMcpTool({
  name: 'quest_get',
  description: 'Load one published quest by slug, including steps.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    slug: z.string(),
  },
  handler: async ({ slug }) => {
    const loaded = await db.content.publishedQuest(slug)
    if (!loaded) {
      throw createError({ statusCode: 404, statusMessage: 'Квест не найден' })
    }
    return {
      id: loaded.quest.id,
      slug: loaded.quest.slug,
      title: loaded.quest.title,
      summary: loaded.quest.summary,
      body: loaded.quest.body,
      publicationStatus: loaded.quest.publicationStatus,
      steps: loaded.steps,
    }
  },
})
