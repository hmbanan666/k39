import { db } from '@k39/database'
import { auditMcp } from '../../utils/mcp/audit'
import { mcpStrictInput, venueListResult, venuesListInput } from '../../utils/mcp/venues'

export default defineMcpTool({
  name: 'venues_list',
  description: 'List venues as { items, total, page, pageSize }. page is 1-based: the offset is (page - 1) * pageSize. pageSize defaults to 20 and stops at 50. There is no offset or limit argument; those keys are rejected. query matches the name or the slug (lowercase, ё and е are the same letter). Filters: regionSlug, kind, status (draft, published, closed, archived), stale (lastVerifiedAt missing or older than 180 days), and near { latitude, longitude, radiusKm }. Each item includes createdAt and updatedAt. Order is name, then id, so paging returns each venue once. total is the filtered count.',
  annotations: { readOnlyHint: true },
  inputSchema: mcpStrictInput(venuesListInput),
  handler: async (input) => {
    const parsed = venuesListInput.parse(input)
    const region = parsed.regionSlug ? await db.venues.regionBySlug(parsed.regionSlug) : null
    if (parsed.regionSlug && !region) {
      throw createError({ statusCode: 400, statusMessage: 'Регион не найден' })
    }
    const page = await db.venues.listPage({
      regionId: region?.id,
      kind: parsed.kind,
      status: parsed.status,
      stale: parsed.stale,
      near: parsed.near,
      query: parsed.query,
      page: parsed.page,
      pageSize: parsed.pageSize,
    })
    await auditMcp('venues_list', 'venue', null)
    return venueListResult(page.items, page.total, page.page, page.pageSize)
  },
})
