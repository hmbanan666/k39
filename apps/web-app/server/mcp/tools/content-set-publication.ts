import { z } from 'zod'
import { setPublication } from '../../utils/mcp/publish'

export default defineMcpTool({
  name: 'content_set_publication',
  description: 'Publish, unpublish, or return to review a place, route, collection, or quest. draft is unpublished. published is live and enters the sitemap unless noindex. Same statuses as the admin form.',
  inputSchema: {
    entity: z.enum(['place', 'route', 'collection', 'quest']),
    id: z.string().optional(),
    slug: z.string().optional(),
    publicationStatus: z.enum(['draft', 'review', 'published']),
  },
  handler: async (input) => setPublication(input),
})
