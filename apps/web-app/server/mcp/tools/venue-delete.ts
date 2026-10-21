import { z } from 'zod'
import { deleteVenue } from '../../utils/venues/write'

export default defineMcpTool({
  name: 'venue_delete',
  description: 'Delete a draft or archived venue. A published or closed venue is left in place. The draft token cannot call this tool. Writes an mcp_audits row.',
  annotations: { destructiveHint: true },
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async ({ id, slug }) => deleteVenue({ id, slug }),
})
