import { db } from '@k39/database'
import { z } from 'zod'
import { slugError } from '../../../shared/seo'
import { auditMcp } from '../../utils/mcp/audit'
import { draftStatus } from '../../utils/mcp/draft'

export default defineMcpTool({
  name: 'route_draft_update',
  description: 'Update a draft or in-review route. Published routes are left unchanged.',
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    body: z.string().optional(),
    publicationStatus: z.enum(['draft', 'review', 'published']).optional(),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
  },
  handler: async (input) => {
    const rows = await db.editor.listRoutes()
    const current = rows.find((item) => item.id === input.id || item.slug === input.slug)
    if (!current) {
      throw createError({ statusCode: 404, statusMessage: 'Маршрут не найден' })
    }
    const publicationStatus = draftStatus(input.publicationStatus, current.publicationStatus)
    const slug = input.slug || current.slug
    const problem = slugError(slug)
    if (problem) {
      throw createError({ statusCode: 400, statusMessage: problem })
    }
    const row = await db.editor.saveRoute({
      id: current.id,
      slug,
      title: input.title || current.title,
      summary: input.summary ?? current.summary,
      body: input.body ?? current.body,
      publicationStatus,
      seoTitle: input.seoTitle === undefined ? current.seoTitle : input.seoTitle,
      seoDescription: input.seoDescription === undefined ? current.seoDescription : input.seoDescription,
    })
    await auditMcp('route_draft_update', 'route', current.id)
    return { id: row?.id, slug: row?.slug, title: row?.title, publicationStatus: row?.publicationStatus }
  },
})
