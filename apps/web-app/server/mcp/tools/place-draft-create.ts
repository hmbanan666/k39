import { z } from 'zod'
import { createPlaceDraft } from '../places'
import { placeFields } from '../schemas'

export default defineMcpTool({
  name: 'place_draft_create',
  description: 'Create a place draft. publicationStatus published is rejected. Publishing stays in /admin.',
  annotations: { destructiveHint: false },
  inputSchema: {
    ...placeFields,
    slug: z.string().describe('URL slug, latin'),
    title: z.string().describe('Visible Russian title'),
  },
  handler: async (input) => createPlaceDraft(input),
})
