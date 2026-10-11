import { db } from '@k39/database'

export default defineMcpTool({
  name: 'quests_list',
  description: 'List published quests. Quest drafts are not writable through MCP.',
  annotations: { readOnlyHint: true },
  inputSchema: {},
  handler: async () => {
    const rows = await db.content.listPublishedQuests()
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      publicationStatus: row.publicationStatus,
    }))
  },
})
