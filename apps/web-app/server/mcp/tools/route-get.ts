import { z } from 'zod'
import { readRoute } from '../../utils/mcp/routes'

export default defineMcpTool({
  name: 'route_get',
  description: 'Load one route by id or slug, including drafts and ordered stops. pendingReview is the stored draft payload when a draft-token write is waiting, or null.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async ({ id, slug }) => readRoute({ id, slug }),
})
