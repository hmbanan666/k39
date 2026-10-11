import { db } from '@k39/database'
import { z } from 'zod'
import { searchCommons } from '../../media/commons'

export default defineMcpTool({
  name: 'commons_search',
  description: 'Search Wikimedia Commons near a place and by title. Only CC0, public domain, CC BY, and CC BY-SA are returned.',
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
