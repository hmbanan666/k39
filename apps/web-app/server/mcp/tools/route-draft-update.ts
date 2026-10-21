import { z } from 'zod'
import { updateRouteDraft } from '../../utils/mcp/routes'
import { orderedStops, routePath } from '../../utils/mcp/schemas'

export default defineMcpTool({
  name: 'route_draft_update',
  description: 'Update a route in place, including one that is already published. Omitting publicationStatus leaves a published route published. A draft-token write to a published or archived route is stored as a pending review and the live row stays. That response is the stored draft: pendingReview, pendingPublicationStatus, bodyLength, renderedFields, and ordered points. publicationStatus in the response stays the live status. Optional points replace the ordered stops; omit them to keep the current stops. An empty array clears the stops. Each placeSlug must exist. A slug change writes a 301 from /marshruty/old.',
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    body: z.string().optional(),
    publicationStatus: z.enum(['draft', 'review', 'published']).optional(),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
    points: orderedStops.describe('Replacement ordered stops. Omit to keep the current stops.'),
    path: routePath,
  },
  handler: async (input) => updateRouteDraft(input),
})
