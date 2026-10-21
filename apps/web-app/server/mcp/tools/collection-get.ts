import { z } from 'zod'
import { readCollection } from '../../utils/mcp/collections'

export default defineMcpTool({
  name: 'collection_get',
  description: 'Load one collection by id or slug, including drafts, ordered places, kind, month, sources, and the other stored fields. article is modules or body: the store the public page renders. renderedFields lists those fields. On a module page body is the stored projection, not a second article. pendingReview is the stored draft payload when a draft-token write is waiting, or null.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async ({ id, slug }) => readCollection({ id, slug }),
})
