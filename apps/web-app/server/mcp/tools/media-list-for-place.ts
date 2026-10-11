import { db } from '@k39/database'
import { z } from 'zod'
import { toPublicMedia } from '../../../shared/media'

export default defineMcpTool({
  name: 'media_list_for_place',
  description: 'List photos attached to a place, cover first.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    placeId: z.string(),
  },
  handler: async ({ placeId }) => {
    const gallery = await db.content.galleryFor(placeId)
    return gallery.map((item) => {
      const media = toPublicMedia(item.media)
      return {
        id: media.id,
        alt: media.alt,
        width: media.width,
        height: media.height,
        isCover: item.isCover,
        sortOrder: item.sortOrder,
        focalX: media.focalX,
        focalY: media.focalY,
        author: media.author,
        license: media.license,
        sourceUrl: media.sourceUrl,
        src: media.src,
      }
    })
  },
})
