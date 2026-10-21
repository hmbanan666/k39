import { z } from 'zod'
import { venueFields } from '../../utils/venues/schema'
import { updateVenue } from '../../utils/venues/write'

export default defineMcpTool({
  name: 'venue_update',
  description: 'Update a venue by id or slug, including status and lastVerifiedAt. Omit a field to keep it. website null clears the site. socials replaces the list, so one call can move a social link out of website into socials. A social host in website is rejected. Omitting status leaves a published venue published. Publishing still requires a 300-600 character description. Writes an mcp_audits row.',
  inputSchema: {
    id: z.string().optional(),
    ...venueFields,
  },
  handler: async (input) => updateVenue(input),
})
