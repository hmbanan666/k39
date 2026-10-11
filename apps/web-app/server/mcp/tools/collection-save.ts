import { db } from '@k39/database'
import { z } from 'zod'
import { slugError } from '../../../shared/seo'
import { auditMcp } from '../../utils/mcp/audit'
import { normalizePublication } from '../../utils/mcp/draft'

export default defineMcpTool({
  name: 'collection_save',
  description: 'Create or update a collection in place. Omitting publicationStatus leaves a published collection published. A slug rename writes a 301 from /podborki/old.',
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
  },
  handler: async (input) => {
    const problem = slugError(input.slug)
    if (problem) {
      throw createError({ statusCode: 400, statusMessage: problem })
    }
    const current = input.id
      ? (await db.editor.listCollections()).find((item) => item.id === input.id)
      : undefined
    const row = await db.editor.saveCollection({
      id: input.id,
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      body: input.body,
      publicationStatus: normalizePublication(input.publicationStatus, current?.publicationStatus),
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      ogImage: input.ogImage,
      noindex: input.noindex,
    })
    await auditMcp('collection_save', 'collection', row?.id)
    return { id: row?.id, slug: row?.slug, title: row?.title, publicationStatus: row?.publicationStatus }
  },
})
