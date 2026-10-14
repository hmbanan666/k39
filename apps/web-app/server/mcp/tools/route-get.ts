import { db } from '@k39/database'
import { z } from 'zod'
import { orderedStopView } from '../../utils/mcp/routes'

export default defineMcpTool({
  name: 'route_get',
  description: 'Load one route by id or slug, including drafts and ordered stops.',
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
    return {
      id: route.id,
      slug: route.slug,
      title: route.title,
      summary: route.summary,
      body: route.body,
      sections: route.sections ?? [],
      publicationStatus: route.publicationStatus,
      seoTitle: route.seoTitle,
      seoDescription: route.seoDescription,
      points: orderedStopView(await db.editor.routePoints(route.id)),
      path: route.path ?? null,
    }
  },
})
