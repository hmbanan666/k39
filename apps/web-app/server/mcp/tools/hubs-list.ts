import { db } from '@k39/database'

export default defineMcpTool({
  name: 'hubs_list',
  description: 'List place hubs (categories) with slug, title, and description.',
  annotations: { readOnlyHint: true },
  inputSchema: {},
  handler: async () => {
    const rows = await db.content.categories()
    return rows.map((row) => ({ slug: row.slug, title: row.title, description: row.description }))
  },
})
