import { z } from 'zod'
import { setPublication } from '../../utils/mcp/publish'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'content_set_publication',
  description: 'Publish, unpublish, or return to review a place, route, collection, or quest. draft is unpublished. published is live and enters the sitemap unless noindex. Same statuses as the admin form. Publishing a place that has a pending draft, with no other fields, applies that payload to the live row and then deletes the draft. Staged notices (ADR 0049) are written in the same transaction; a place draft that holds only notices writes them and leaves the publication status alone. entity venue takes only published, from the editor token, with no other fields: it applies staged venue fields, the opening schedule, menu prices and notices (ADR 0047) in one transaction without changing status. Newer owner changes block only their staged keys; ownerConflicts lists those keys and they remain pending. The same writer serves PATCH /api/content/places.',
  inputSchema: {
    entity: z.enum(['place', 'route', 'collection', 'quest', 'venue']),
    id: z.string().optional(),
    slug: z.string().optional(),
    publicationStatus: z.enum(['draft', 'review', 'published']),
  },
  handler: async (input) => setPublication(input),
})
