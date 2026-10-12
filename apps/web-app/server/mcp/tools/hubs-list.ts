import { db } from '@k39/database'

export default defineMcpTool({
  name: 'hubs_list',
  description: 'List place hubs (categories) with slug, title, description, markdown body, and SEO fields.',
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
    }))
  },
})
