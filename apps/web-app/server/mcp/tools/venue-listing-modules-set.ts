import { db, VenueInputError } from '@k39/database'
import { z } from 'zod'
import { listingModulesSchema } from '../../../shared/listing-modules'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'venue_listing_modules_set',
  description: 'Replace the content modules of a venue listing (/zavedeniya, a town, a kind, or both). regionSlug and kind are optional; null means all regions or all kinds. An empty array clears the modules. Does not change the intro text. Each situation placeSlug must be a published venue. Writes an mcp_audits row. See docs/venue-modules.md.',
  inputSchema: {
    regionSlug: z.string().nullable().optional(),
    kind: z.string().nullable().optional(),
    modules: z.array(z.unknown()),
  },
  handler: async (input) => {
    const region = input.regionSlug ? await db.venues.regionBySlug(input.regionSlug) : null
    if (input.regionSlug && !region) {
      throw createError({ statusCode: 400, statusMessage: 'Регион не найден' })
    }
    const parsed = listingModulesSchema.safeParse(input.modules)
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Неверные модули' })
    }
    const slugs = parsed.data.flatMap((module) => module.type === 'situation' ? module.items.map((item) => item.placeSlug) : [])
    for (const slug of slugs) {
      const venue = await db.venues.bySlug(slug)
      if (!venue || venue.status !== 'published') {
        throw createError({ statusCode: 400, statusMessage: `Заведение не найдено: ${slug}` })
      }
    }
    try {
      const row = await db.venues.setListingModules({
        regionId: region?.id ?? null,
        kind: input.kind ?? null,
        modules: parsed.data,
      })
      await auditMcp('venue_listing_modules_set', 'venue_listing', row.id)
      return { id: row.id, regionId: row.regionId, kind: row.kind, modules: row.modules }
    } catch (error) {
      if (error instanceof VenueInputError) {
        throw createError({ statusCode: 400, statusMessage: error.message })
      }
      throw error
    }
  },
})
