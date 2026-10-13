import { z } from 'zod'
import { updateVenue } from '../../utils/venues/mutate'
import { venueFields } from '../../utils/venues/schema'

export default defineMcpTool({
  name: 'venue_update',
  description: 'Update a venue, including one that is already published. Send lastVerifiedAt as an ISO date to record a check. status is draft, published, closed, or archived. Omitting a field keeps the stored value. The write is an mcp_audits row.',
  inputSchema: {
    id: z.string().optional(),
    ...venueFields,
  },
  handler: async (input) => updateVenue(input),
})
