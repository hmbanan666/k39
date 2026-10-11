import { db } from '@k39/database'

export default defineMcpTool({
  name: 'quests_list',
  description: 'List quests, including drafts.',
  annotations: { readOnlyHint: true },
  inputSchema: {},
  handler: async () => {
    const rows = await db.editor.listQuests()
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      publicationStatus: row.publicationStatus,
    }))
  },
})
