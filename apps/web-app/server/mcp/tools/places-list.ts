import type { PublicationStatus, VisitStatus } from '@k39/database'
import { db } from '@k39/database'
import { z } from 'zod'

const PUBLICATION = new Set(['draft', 'review', 'published'])

export default defineMcpTool({
  name: 'places_list',
  description: 'List places. Filter by hub slug, publication or visit status, region slug, or a title query. Paginated.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    category: z.string().optional().describe('Hub slug such as forty'),
    status: z.string().optional().describe('draft, review, published, or a visit status: open, ruins, closed, unknown'),
    region: z.string().optional().describe('Region slug'),
    query: z.string().optional().describe('Matches title, slug, or summary'),
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(50).optional(),
  },
  handler: async ({ category, status, region, query, page, pageSize }) => {
    const publicationStatus = status && PUBLICATION.has(status) ? status as PublicationStatus : undefined
    const visitStatus = status && !publicationStatus ? status as VisitStatus : undefined
    const result = await db.editor.searchPlaces({
      categorySlug: category,
      regionSlug: region,
      publicationStatus,
      visitStatus,
      query,
      page: page ?? 1,
      pageSize: pageSize ?? 20,
    })
    return { ...result, page: page ?? 1, pageSize: pageSize ?? 20 }
  },
})
