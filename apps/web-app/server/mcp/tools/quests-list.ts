import { db } from '@k39/database'
import { routeSlugOf } from '../../utils/mcp/quests'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'quests_list',
  description: 'List quests, including drafts. routeSlug is the linked route, or null.',
  annotations: { readOnlyHint: true },
  inputSchema: {},
  handler: async () => {
    const [rows, routes] = await Promise.all([
      db.editor.listQuests(),
      db.editor.listRoutes(),
    ])
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      publicationStatus: row.publicationStatus,
      routeSlug: routeSlugOf(row.routeId, routes),
    }))
  },
})
