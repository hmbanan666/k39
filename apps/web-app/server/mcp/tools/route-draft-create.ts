import { db } from '@k39/database'
import { z } from 'zod'
import { slugError } from '../../../shared/seo'
import { auditMcp } from '../../utils/mcp/audit'
import { normalizePublication } from '../../utils/mcp/draft'

export default defineMcpTool({
  name: 'route_draft_create',
  description: 'Create a route. publicationStatus may be draft, review, or published. A slug rename writes a 301 from /marshruty/old.',
  inputSchema: {
    slug: z.string(),
    title: z.string(),
    summary: z.string().optional(),
    body: z.string().optional(),
    publicationStatus: z.enum(['draft', 'review', 'published']).optional(),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
  },
  handler: async (input) => {
    const publicationStatus = normalizePublication(input.publicationStatus)
    const problem = slugError(input.slug)
    if (problem) {
      throw createError({ statusCode: 400, statusMessage: problem })
    }
    const row = await db.editor.saveRoute({
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      body: input.body,
      publicationStatus,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
    })
    await auditMcp('route_draft_create', 'route', row?.id)
    return { id: row?.id, slug: row?.slug, title: row?.title, publicationStatus: row?.publicationStatus }
  },
})
