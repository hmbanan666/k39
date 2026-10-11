import { z } from 'zod'
import { updatePlaceDraft } from '../places'
import { placeFields } from '../schemas'

export default defineMcpTool({
  name: 'place_draft_update',
  description: 'Update a draft or in-review place. Published pages are left unchanged.',
  inputSchema: {
    id: z.string().optional(),
    ...placeFields,
  },
  handler: async (input) => updatePlaceDraft(input),
})
