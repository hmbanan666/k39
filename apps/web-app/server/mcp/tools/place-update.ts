import { z } from 'zod'
import { updatePlaceDraft } from '../../utils/mcp/places'
import { placeFields } from '../../utils/mcp/schemas'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'place_update',
  description:
    'Update a place in place, including one that is already published. Omitting publicationStatus does not unpublish. A slug change writes a 301. regionSlug selects a named catalogue area from region_list, not a verified settlement. factsCheckedAt is an ISO date stored as last_verified_at. Send it alone with id or slug to record a check without other edits. phone and website are official contacts shown in «Коротко» and in JSON-LD (telephone, url). A phone needs phoneSourceUrl on the own site of the place, or a website to fall back on; a map, a listing such as Tripadvisor or KudaGo, or a Yandex business card is rejected, and a social page counts only while website is empty. schemaType overrides the hub schema.org type (Church, PlaceOfWorship, Park, PerformingArtsTheater, MusicVenue, Museum, ...); null returns to the hub default. The write is an mcp_audits row. A draft token write to a published or archived place is stored as a pending review and the live row stays. That response is the stored draft: pendingReview, bodyLength, renderedFields, and pendingPublicationStatus. publicationStatus in the response stays the live status. An editor write that changes the live row drops the pending draft it saw, in that same save, and returns draftDropped. A newer draft stays.',
  inputSchema: {
    id: z.string().optional(),
    ...placeFields,
  },
  handler: async (input) => updatePlaceDraft(input, 'place_update'),
})
