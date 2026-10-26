import { SOURCE_LINK_LIMIT } from '@k39/database'
import { z } from 'zod'
import { pageModulesSchema } from '../../../shared/page-modules'
import { saveCollectionDraft } from '../../utils/mcp/collections'
import { orderedStops, sources } from '../../utils/mcp/schemas'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'collection_save',
  description:
    "Create or update a collection in place. Omitting publicationStatus leaves a published collection published. A draft-token write to a published or archived collection is stored as a pending review and the live row stays. That response is the stored draft: pendingReview, pendingPublicationStatus, bodyLength, renderedFields, and ordered items. publicationStatus in the response stays the live status. Optional items replace the ordered places; omit them to keep the current list. An empty array clears it. Each placeSlug must exist. A slug rename writes a 301 from /podborki/old. kind 'month' with month 1..12 makes a month guide; sources render in a separate Sources block, so keep external links out of body. modules replaces the ordered page modules (ADR 0023, see content_guide); omit to keep them, an empty array returns the page to the plain article layout. When modules render, they are the article: body is stored as their projection, the response lists renderedFields, and a different body is a 400. The stop-list reads that projection. An editor write that changes the live row drops the pending draft it saw, in that same save, and returns draftDropped. A newer draft stays.",
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
    sources: sources.describe(
      `Replacement source list, at most ${SOURCE_LINK_LIMIT}. Duplicate URLs merge. Omit to keep the current one.`,
    ),
    items: orderedStops.describe('Replacement ordered places. Omit to keep the current list.'),
    modules: pageModulesSchema
      .optional()
      .describe(
        'Replacement ordered page modules: text, month-stats, picker, ideas, plans, places, months. Omit to keep them.',
      ),
  },
  handler: async (input) => saveCollectionDraft(input),
})
