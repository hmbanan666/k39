import { z } from 'zod'
import { submitPlaceReview } from '../../utils/mcp/places'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'place_submit_review',
  description: 'Move a place to review. Does not by itself publish.',
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async (input) => submitPlaceReview(input),
})
