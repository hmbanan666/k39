import { db } from '@k39/database'
import { z } from 'zod'
import { searchCommons } from '../../media/commons'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'commons_search',
  description: 'Search Wikimedia Commons near a place. When geosearch returns nothing, also search file titles and Commons categories, including an English "Fort N Kaliningrad" query for numbered forts. Only CC0, public domain, CC BY, and CC BY-SA are returned.',
  annotations: { readOnlyHint: true, openWorldHint: true },
  inputSchema: {
    placeId: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    title: z.string().optional(),
  },
  handler: async (input) => {
    const place = input.placeId ? await db.editor.placeById(input.placeId) : null
    const hits = await searchCommons({
      lat: input.lat ?? place?.latitude,
      lng: input.lng ?? place?.longitude,
      title: input.title || place?.title,
    })
    return hits.map((hit) => ({
      title: hit.title,
      description: hit.description,
      categories: hit.categories,
      author: hit.author,
      license: hit.license,
      width: hit.width,
      height: hit.height,
      thumbUrl: hit.thumbUrl,
      fileUrl: hit.fileUrl,
      pageUrl: hit.pageUrl,
    }))
  },
})
