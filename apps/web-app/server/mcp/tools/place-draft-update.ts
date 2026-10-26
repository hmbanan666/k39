import { z } from 'zod'
import { updatePlaceDraft } from '../../utils/mcp/places'
import { placeFields } from '../../utils/mcp/schemas'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'place_draft_update',
  description:
    'Alias of place_update. Updates a place in place. Omitting publicationStatus leaves a published page published. factsCheckedAt is an ISO date stored as last_verified_at. Send it alone with id or slug to record a check without other edits. The write is an mcp_audits row. A draft token write to a published or archived place is stored as a pending review and the live row stays. That response is the stored draft: pendingReview, bodyLength, renderedFields, and pendingPublicationStatus. An editor write that changes the live row drops the pending draft it saw and returns draftDropped. A newer draft stays.',
  inputSchema: {
    id: z.string().optional(),
    ...placeFields,
  },
  handler: async (input) => updatePlaceDraft(input),
})
