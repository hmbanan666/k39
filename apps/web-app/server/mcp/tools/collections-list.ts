import { db } from '@k39/database'

export default defineMcpTool({
  name: 'collections_list',
  description: 'List collections (podborki), including drafts.',
  annotations: { readOnlyHint: true },
  inputSchema: {},
  handler: async () => {
    const rows = await db.editor.listCollections()
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      publicationStatus: row.publicationStatus,
    }))
  },
})
