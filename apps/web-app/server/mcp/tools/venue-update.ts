import { SOURCE_LINK_LIMIT } from '@k39/database'
import { z } from 'zod'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { venueFields } from '../../utils/venues/schema'
import { updateVenue } from '../../utils/venues/write'

export default defineStrictMcpTool({
  name: 'venue_update',
  description: `A draft-token update of a published or closed venue stages allowed fields for editor review (ADR 0047), keeping the live row, schedule, prices and facts. status, slug edits, SEO, socials, VK identity, osmId and contactEmail stay editor-only. hours is refused on that path; use schedule_set. An archived venue refuses draft-token edits. Update a venue by id or slug, including status and lastVerifiedAt. Omit a field to keep it. website null clears the site. socials replaces the list, so one call can move a social link out of website into socials. A social host in website is rejected. vkCommunityId is the numeric id of the VK community that socials link by screen name, read from that community's own album-, photo-, wall-, or market- URL; it lets those VK menu prices count. It needs a VK link in socials and a positive integer. When every VK link is already club, public, or event, it must be that number. A socials write without vkCommunityId keeps the id only while it still fits the new socials; a screen-name change keeps it, so clear it with null when the venue moves to another community. Null clears it. Omitting status leaves a published venue published. Publishing still requires a 300-600 character description. sources allows ${SOURCE_LINK_LIMIT} rows; duplicate URLs merge, and a row without a title or an http(s) URL is rejected. unchanged is true only for the venue row: no revision and no updatedAt bump. A schedule, a fact, or coordinates still update in their own tables. Writes an mcp_audits row.`,
  inputSchema: {
    id: z.string().optional(),
    ...venueFields,
  },
  handler: async (input) => updateVenue(input),
})
