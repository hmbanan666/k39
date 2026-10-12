import { z } from 'zod'
import { updatePlaceDraft } from '../../utils/mcp/places'
import { placeFields } from '../../utils/mcp/schemas'

export default defineMcpTool({
  name: 'place_draft_update',
  description: 'Alias of place_update. Updates a place in place. Omitting publicationStatus leaves a published page published. factsCheckedAt is an ISO date stored as last_verified_at. Send it alone with id or slug to record a check without other edits. The write is an mcp_audits row.',
  inputSchema: {
    id: z.string().optional(),
    ...placeFields,
  },
  handler: async (input) => updatePlaceDraft(input),
})
