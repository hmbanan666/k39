import { z } from 'zod'
import { submitPlaceReview } from '../../utils/mcp/places'

export default defineMcpTool({
  name: 'place_submit_review',
  description: 'Move a place to review. Does not by itself publish.',
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async (input) => submitPlaceReview(input),
})
