import { z } from 'zod'
import { updateRouteDraft } from '../../utils/mcp/routes'
import { orderedStops } from '../../utils/mcp/schemas'

export default defineMcpTool({
  name: 'route_update',
  description: 'Update a route in place, including one that is already published. Same behavior as route_draft_update. Omitting publicationStatus does not unpublish. Optional points replace ordered stops.',
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
  },
  handler: async (input) => updateRouteDraft(input, 'route_update'),
})
