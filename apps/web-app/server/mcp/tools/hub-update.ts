import { db } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'hub_update',
  description: 'Update an editable hub (category): title, description, SEO, and noindex. Hubs have no publication status. Does not change users or settings.',
  inputSchema: {
    slug: z.string().describe('Hub slug: forty, zamki, plyazhi, kurorty, muzei, eda'),
    title: z.string().optional(),
    description: z.string().optional(),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
    ogImage: z.string().nullable().optional(),
    noindex: z.boolean().optional(),
  },
  handler: async (input) => {
    const current = await db.content.categoryBySlug(input.slug)
    if (!current) {
      throw createError({ statusCode: 404, statusMessage: 'Раздел не найден' })
    }
    const row = await db.editor.saveCategory(current.id, {
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      seoTitle: input.seoTitle === undefined ? current.seoTitle : input.seoTitle,
      seoDescription: input.seoDescription === undefined ? current.seoDescription : input.seoDescription,
      ogImage: input.ogImage === undefined ? current.ogImage : input.ogImage,
      noindex: input.noindex ?? current.noindex,
    })
    await auditMcp('hub_update', 'hub', current.id)
    return { id: row?.id, slug: row?.slug, title: row?.title, noindex: row?.noindex }
  },
})
