import { db } from '@k39/database'
import { z } from 'zod'

export default defineMcpTool({
  name: 'route_get',
  description: 'Load one route by id or slug. Published routes include ordered stops.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async ({ id, slug }) => {
    const rows = await db.editor.listRoutes()
    const route = rows.find((item) => item.id === id || item.slug === slug)
    if (!route) {
      throw createError({ statusCode: 404, statusMessage: 'Маршрут не найден' })
    }
    const published = route.publicationStatus === 'published'
      ? await db.content.publishedRoute(route.slug)
      : null
    return {
      id: route.id,
      slug: route.slug,
      title: route.title,
      summary: route.summary,
      body: route.body,
      publicationStatus: route.publicationStatus,
      seoTitle: route.seoTitle,
      seoDescription: route.seoDescription,
      points: published?.points ?? [],
    }
  },
})
