import { db } from '@k39/database'
import { z } from 'zod'
import { slugError } from '../../../shared/seo'
import { auditMcp } from '../../utils/mcp/audit'
import { rethrowContentWrite } from '../../utils/mcp/content-error'
import { normalizePublication } from '../../utils/mcp/draft'
import { orderedStopView } from '../../utils/mcp/routes'
import { orderedStops, sources } from '../../utils/mcp/schemas'

export default defineMcpTool({
  name: 'collection_save',
  description: 'Create or update a collection in place, including one that is already published. Omitting publicationStatus leaves a published collection published. Optional items replace the ordered places; omit them to keep the current list. An empty array clears it. Each placeSlug must exist. A slug rename writes a 301 from /podborki/old. kind \'month\' with month 1..12 makes a month guide; sources render in a separate Sources block, so keep external links out of body.',
  inputSchema: {
    id: z.string().optional(),
    slug: z.string(),
    title: z.string(),
    summary: z.string().nullable().optional(),
    body: z.string().optional(),
    publicationStatus: z.enum(['draft', 'review', 'published']).optional(),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
    ogImage: z.string().nullable().optional(),
    noindex: z.boolean().optional(),
    kind: z.enum(['theme', 'month']).optional(),
    month: z.number().int().min(1).max(12).nullable().optional(),
    sources: sources.describe('Replacement source list. Omit to keep the current one.'),
    items: orderedStops.describe('Replacement ordered places. Omit to keep the current list.'),
  },
  handler: async (input) => {
    const problem = slugError(input.slug)
    if (problem) {
      throw createError({ statusCode: 400, statusMessage: problem })
    }
    const rows = await db.editor.listCollections()
    const current = input.id
      ? rows.find((item) => item.id === input.id)
      : rows.find((item) => item.slug === input.slug)
    try {
      const row = await db.editor.saveCollection({
        id: current?.id ?? input.id,
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        body: input.body,
        publicationStatus: normalizePublication(input.publicationStatus, current?.publicationStatus),
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        ogImage: input.ogImage,
        noindex: input.noindex,
        items: input.items,
        kind: input.kind,
        month: input.kind === 'theme' ? null : input.month,
        sources: input.sources,
      })
      await auditMcp('collection_save', 'collection', row.id)
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        publicationStatus: row.publicationStatus,
        kind: row.kind,
        month: row.month,
        sources: row.sources,
        items: orderedStopView(await db.editor.collectionItems(row.id)),
      }
    } catch (error) {
      rethrowContentWrite(error)
    }
  },
})
