import { z } from 'zod'
import { updatePlaceDraft } from '../../utils/mcp/places'
import { placeFields } from '../../utils/mcp/schemas'

export default defineMcpTool({
  name: 'place_update',
  description: 'Update a place in place, including one that is already published. Omitting publicationStatus does not unpublish. A slug change writes a 301. regionSlug must be a slug from the regions table. factsCheckedAt is an ISO date stored as last_verified_at. Send it alone with id or slug to record a check without other edits. The write is an mcp_audits row.',
  inputSchema: {
    id: z.string().optional(),
    ...placeFields,
  },
  handler: async (input) => updatePlaceDraft(input, 'place_update'),
})
