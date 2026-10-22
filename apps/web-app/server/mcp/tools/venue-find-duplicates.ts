import { db } from '@k39/database'
import { auditMcp } from '../../utils/mcp/audit'
import { defineStrictMcpTool, mcpStrictInput } from '../../utils/mcp/tool'
import { venueDuplicatesInput } from '../../utils/mcp/venues'

export default defineStrictMcpTool({
  name: 'venue_find_duplicates',
  description: 'Read-only duplicate check before venue_create. Matches a name ignoring case, ё/е, quotes, and a kind word such as кафе or ресторан, and a point within radiusM metres (default 150, maximum 2000). Archived and closed venues are included. Optional regionSlug limits the search. Returns slug, name, kind, status, region, distanceM, and matched signals (name, coordinates). Pass a name, or latitude and longitude together.',
  annotations: { readOnlyHint: true },
  inputSchema: mcpStrictInput(venueDuplicatesInput),
  handler: async (input) => {
    const parsed = venueDuplicatesInput.parse(input)
    const region = parsed.regionSlug ? await db.venues.regionBySlug(parsed.regionSlug) : null
    if (parsed.regionSlug && !region) {
      throw createError({ statusCode: 400, statusMessage: 'Регион не найден' })
    }
    const items = await db.venues.findDuplicates({
      name: parsed.name,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      radiusM: parsed.radiusM,
      regionId: region?.id,
    })
    await auditMcp('venue_find_duplicates', 'venue', null)
    return { items }
  },
})
