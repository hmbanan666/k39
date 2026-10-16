import { db } from '@k39/database'
import { HUB_RENDERED_FIELDS } from '../../../shared/page-modules'

export default defineMcpTool({
  name: 'hubs_list',
  description: 'List place hubs (categories) with slug, title, description, markdown body, and SEO fields. renderedFields lists what the hub page shows. body is the article.',
  annotations: { readOnlyHint: true },
  inputSchema: {},
  handler: async () => {
    const rows = await db.content.categories()
    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      description: row.description,
      body: row.body,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      ogImage: row.ogImage,
      noindex: row.noindex,
      article: 'body' as const,
      renderedFields: HUB_RENDERED_FIELDS,
    }))
  },
})
