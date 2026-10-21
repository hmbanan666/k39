import { venueCreateSchema } from '../../utils/venues/schema'
import { createVenue } from '../../utils/venues/write'

export default defineMcpTool({
  name: 'venue_create',
  description: 'Create a venue. kind is cafe, restaurant, coffee, bar, bakery, market, fastfood, other, or a later latin token. status defaults to draft. Publishing requires a Russian description of 300-600 characters. website is only the venue\'s own site. A social host belongs in socials. Writes an mcp_audits row.',
  inputSchema: venueCreateSchema,
  handler: async (input) => createVenue(input),
})
