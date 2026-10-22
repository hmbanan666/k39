import { db } from '@k39/database'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'routes_list',
  description: 'List routes, including drafts.',
  annotations: { readOnlyHint: true },
  inputSchema: {},
  handler: async () => {
    const rows = await db.editor.listRoutes()
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      publicationStatus: row.publicationStatus,
    }))
  },
})
