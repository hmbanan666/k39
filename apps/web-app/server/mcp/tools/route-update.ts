import { z } from 'zod'
import { updateRouteDraft } from '../../utils/mcp/routes'
import { bodySections, orderedStops, routePath } from '../../utils/mcp/schemas'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'route_update',
  description:
    'Update a route in place, including one that is already published. Same behavior as route_draft_update. Omitting publicationStatus does not unpublish. A draft-token write to a published or archived route is stored as a pending review and the live row stays. That response is the stored draft: pendingReview, pendingPublicationStatus, bodyLength, renderedFields, and ordered points. Optional points replace ordered stops. An editor write that changes the live row drops the pending draft it saw, in that same save, and returns draftDropped. A newer draft stays.',
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    body: z.string().optional(),
    sections: bodySections,
    publicationStatus: z.enum(['draft', 'review', 'published']).optional(),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
    points: orderedStops.describe('Replacement ordered stops. Omit to keep the current stops.'),
    path: routePath,
  },
  handler: async (input) => updateRouteDraft(input, 'route_update'),
})
