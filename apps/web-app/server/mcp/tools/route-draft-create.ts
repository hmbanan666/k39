import { z } from 'zod'
import { createRouteDraft } from '../../utils/mcp/routes'
import { orderedStops, routePath } from '../../utils/mcp/schemas'

export default defineMcpTool({
  name: 'route_draft_create',
  description: 'Create a route. publicationStatus may be draft, review, or published. Optional points are ordered stops; each placeSlug must already exist and note is optional. A slug rename writes a 301 from /marshruty/old.',
  inputSchema: {
    slug: z.string(),
    title: z.string(),
    summary: z.string().optional(),
    body: z.string().optional(),
    publicationStatus: z.enum(['draft', 'review', 'published']).optional(),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
    points: orderedStops.describe('Ordered stops. Omit to leave stops empty on create. An empty array stores no stops.'),
    path: routePath,
  },
  handler: async (input) => createRouteDraft(input),
})
