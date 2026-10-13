import { db } from '@k39/database'
import { z } from 'zod'
import { collectionView } from '../../utils/mcp/collections'

export default defineMcpTool({
  name: 'collection_get',
  description: 'Load one collection by id or slug, including drafts, ordered places, kind, month, sources, and the other stored fields.',
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
    return collectionView(row, await db.editor.collectionItems(row.id))
  },
})
