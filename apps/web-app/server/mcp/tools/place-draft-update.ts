import { z } from 'zod'
import { updatePlaceDraft } from '../../utils/mcp/places'
import { placeFields } from '../../utils/mcp/schemas'

export default defineMcpTool({
  name: 'place_draft_update',
  description: 'Alias of place_update. Updates a place in place. Omitting publicationStatus leaves a published page published.',
  inputSchema: {
    id: z.string().optional(),
    ...placeFields,
  },
  handler: async (input) => updatePlaceDraft(input),
})
