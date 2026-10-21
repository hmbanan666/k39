import { db } from '@k39/database'
import { z } from 'zod'
import { HUB_RENDERED_FIELDS } from '../../../shared/page-modules'
import { requireEditorContent } from '../../utils/access'
import { saveHubContent } from '../../utils/content/save'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'hub_update',
  description: 'Update an editable hub (category): title, description, markdown body, SEO, and noindex. A "## Частые вопросы" section in body becomes FAQPage. A question is **…?** or a ### heading. Omitting a field keeps the stored value. Hubs have no publication status. A banned site in the text or a URL is rejected. The response lists renderedFields; body is the article. Does not change users or settings.',
  inputSchema: {
    slug: z.string().describe('Hub slug: forty, zamki, plyazhi, kurorty, muzei, eda'),
    title: z.string().optional(),
    description: z.string().optional(),
    body: z.string().optional().describe('Markdown article. "## Частые вопросы" is parsed into FAQPage. A question is **…?** or a ### heading.'),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
    ogImage: z.string().nullable().optional(),
    noindex: z.boolean().optional(),
  },
  handler: async (input) => {
    requireEditorContent('edit a hub')
    const current = await db.content.categoryBySlug(input.slug)
    if (!current) {
      throw createError({ statusCode: 404, statusMessage: 'Раздел не найден' })
    }
    const title = input.title ?? current.title
    const description = input.description ?? current.description
    const body = input.body === undefined ? current.body : input.body
    const seoTitle = input.seoTitle === undefined ? current.seoTitle : input.seoTitle
    const seoDescription = input.seoDescription === undefined ? current.seoDescription : input.seoDescription
    const { row, writingWarnings } = await saveHubContent(current.id, {
      title,
      description,
      body,
      seoTitle,
      seoDescription,
      ogImage: input.ogImage === undefined ? current.ogImage : input.ogImage,
      noindex: input.noindex ?? current.noindex,
    }, {
      prose: [title, description, body, seoTitle, seoDescription],
      publishing: true,
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
      article: 'body' as const,
      renderedFields: HUB_RENDERED_FIELDS,
      writingWarnings,
    }
  },
})
