import { db } from '@k39/database'
import { z } from 'zod'
import { orderedStopView } from '../../utils/mcp/routes'

export default defineMcpTool({
  name: 'collection_get',
  description: 'Load one collection by id or slug, including drafts and ordered places.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async ({ id, slug }) => {
    const rows = await db.editor.listCollections()
    const row = rows.find((item) => item.id === id || item.slug === slug)
    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'Подборка не найдена' })
    }
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      body: row.body,
      publicationStatus: row.publicationStatus,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      noindex: row.noindex,
      items: orderedStopView(await db.editor.collectionItems(row.id)),
    }
  },
})
