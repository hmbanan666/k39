import { db } from '@k39/database'
import { z } from 'zod'
import { COLLECTION_BODY_REJECTED, collectionWritePlan, pageModulesSchema } from '../../../shared/page-modules'
import { slugError } from '../../../shared/seo'
import { saveCollectionContent } from '../../utils/content/save'
import { auditMcp } from '../../utils/mcp/audit'
import { rethrowContentWrite } from '../../utils/mcp/content-error'
import { refusePendingLiveEdit, resolvePublication } from '../../utils/mcp/draft'
import { orderedStopView } from '../../utils/mcp/routes'
import { orderedStops, sources } from '../../utils/mcp/schemas'

export default defineMcpTool({
  name: 'collection_save',
  description: 'Create or update a collection in place, including one that is already published. Omitting publicationStatus leaves a published collection published. Optional items replace the ordered places; omit them to keep the current list. An empty array clears it. Each placeSlug must exist. A slug rename writes a 301 from /podborki/old. kind \'month\' with month 1..12 makes a month guide; sources render in a separate Sources block, so keep external links out of body. modules replaces the ordered page modules (ADR 0023, see content_guide); omit to keep them, an empty array returns the page to the plain article layout. When modules render, they are the article: body is stored as their projection, the response lists renderedFields, and a different body is a 400. The stop-list reads that projection.',
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
    modules: pageModulesSchema.optional().describe('Replacement ordered page modules: text, month-stats, picker, ideas, plans, places, months. Omit to keep them.'),
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
    const publicationStatus = resolvePublication(input.publicationStatus, current?.publicationStatus)
    refusePendingLiveEdit(publicationStatus, 'collection')
    const modules = input.modules === undefined ? current?.modules : input.modules
    const plan = collectionWritePlan({
      sentBody: input.body,
      currentBody: current?.body,
      modules,
    })
    if (plan.rejectBody) {
      throw createError({ statusCode: 400, statusMessage: COLLECTION_BODY_REJECTED })
    }
    try {
      const { row, writingWarnings } = await saveCollectionContent({
        id: current?.id ?? input.id,
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        body: plan.body,
        publicationStatus,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        ogImage: input.ogImage,
        noindex: input.noindex,
        items: input.items,
        kind: input.kind,
        month: input.kind === 'theme' ? null : input.month,
        sources: input.sources,
        modules: input.modules,
      }, null, {
        parts: [
          input.title,
          input.summary === undefined ? current?.summary : input.summary,
          plan.copy,
          input.seoTitle === undefined ? current?.seoTitle : input.seoTitle,
          input.seoDescription === undefined ? current?.seoDescription : input.seoDescription,
          input.items,
          input.sources === undefined ? current?.sources : input.sources,
        ],
        publishing: publicationStatus === 'published',
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
        body: row.body,
        modules: row.modules,
        article: plan.article,
        renderedFields: plan.renderedFields,
        items: orderedStopView(await db.editor.collectionItems(row.id)),
        writingWarnings,
      }
    } catch (error) {
      rethrowContentWrite(error)
    }
  },
})
