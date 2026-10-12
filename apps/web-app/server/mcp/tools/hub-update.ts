import { db } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'hub_update',
  description: 'Update an editable hub (category): title, description, markdown body, SEO, and noindex. A "## Частые вопросы" section in body becomes FAQPage. Omitting a field keeps the stored value. Hubs have no publication status. Does not change users or settings.',
  inputSchema: {
    slug: z.string().describe('Hub slug: forty, zamki, plyazhi, kurorty, muzei, eda'),
    title: z.string().optional(),
    description: z.string().optional(),
    body: z.string().optional().describe('Markdown article. "## Частые вопросы" is parsed into FAQPage.'),
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
      body: input.body === undefined ? current.body : input.body,
      seoTitle: input.seoTitle === undefined ? current.seoTitle : input.seoTitle,
      seoDescription: input.seoDescription === undefined ? current.seoDescription : input.seoDescription,
      ogImage: input.ogImage === undefined ? current.ogImage : input.ogImage,
      noindex: input.noindex ?? current.noindex,
    })
    await auditMcp('hub_update', 'hub', current.id)
    return {
      id: row?.id,
      slug: row?.slug,
      title: row?.title,
      description: row?.description,
      body: row?.body,
      seoTitle: row?.seoTitle,
      seoDescription: row?.seoDescription,
      ogImage: row?.ogImage,
      noindex: row?.noindex,
    }
  },
})
