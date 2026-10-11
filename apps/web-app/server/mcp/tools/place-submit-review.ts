import { z } from 'zod'
import { submitPlaceReview } from '../../utils/mcp/places'

export default defineMcpTool({
  name: 'place_submit_review',
  description: 'Move a draft place to review. Does not publish.',
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async (input) => submitPlaceReview(input),
})
