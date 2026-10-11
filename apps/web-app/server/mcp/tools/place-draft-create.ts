import { z } from 'zod'
import { createPlaceDraft } from '../../utils/mcp/places'
import { placeFields } from '../../utils/mcp/schemas'

export default defineMcpTool({
  name: 'place_draft_create',
  description: 'Create a place. publicationStatus may be draft, review, or published. A slug rename writes a 301 slug redirect.',
  annotations: { destructiveHint: false },
  inputSchema: {
    ...placeFields,
    slug: z.string().describe('URL slug, latin'),
    title: z.string().describe('Visible Russian title'),
  },
  handler: async (input) => createPlaceDraft(input),
})
