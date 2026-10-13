import { z } from 'zod'
import { setVenueListingIntro } from '../../utils/venues/mutate'

export default defineMcpTool({
  name: 'venue_listing_intro_set',
  description: 'Set the intro for a venue filter page. regionSlug empty is /zavedeniya. kind is a public slug such as kofe, or a kind such as coffee. Region plus kind is /zavedeniya/{region}/{kind}. The write is an mcp_audits row.',
  inputSchema: {
    regionSlug: z.string().nullable().optional(),
    kind: z.string().nullable().optional(),
    intro: z.string(),
  },
  handler: async (input) => setVenueListingIntro({
    regionSlug: input.regionSlug,
    kind: input.kind,
    intro: input.intro,
  }),
})
