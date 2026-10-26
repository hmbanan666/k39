import { db, VenueInputError } from '@k39/database'
import { z } from 'zod'
import { requireEditorContent } from '../../utils/access'
import { auditMcp } from '../../utils/mcp/audit'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'venue_listing_intro_set',
  description:
    'Set the intro for a venue listing. regionSlug and kind are optional; null means all regions or all kinds. An intro of at least 300 characters makes /zavedeniya/{region}/{kind} indexable. Writes an mcp_audits row.',
  inputSchema: {
    regionSlug: z.string().nullable().optional(),
    kind: z.string().nullable().optional(),
    body: z.string(),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
  },
  handler: async (input) => {
    requireEditorContent('edit a venue listing')
    const region = input.regionSlug ? await db.venues.regionBySlug(input.regionSlug) : null
    if (input.regionSlug && !region) {
      throw createError({ statusCode: 400, statusMessage: 'Территория каталога не найдена' })
    }
    try {
      const row = await db.venues.setListingIntro({
        regionId: region?.id ?? null,
        kind: input.kind ?? null,
        body: input.body,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
      })
      await auditMcp('venue_listing_intro_set', 'venue_listing', row.id)
      return row
    } catch (error) {
      if (error instanceof VenueInputError) {
        throw createError({ statusCode: 400, statusMessage: error.message })
      }
      throw error
    }
  },
})
