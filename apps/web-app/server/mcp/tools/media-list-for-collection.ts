import { db } from '@k39/database'
import { z } from 'zod'
import { toPublicMedia } from '../../../shared/media'

export default defineMcpTool({
  name: 'media_list_for_collection',
  description: 'List photos attached to a collection, cover first.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    collectionId: z.string(),
  },
  handler: async ({ collectionId }) => {
    const gallery = await db.content.collectionGallery(collectionId)
    return gallery.map((item) => {
      const media = toPublicMedia(item.media)
      return {
        id: media.id,
        alt: media.alt,
        caption: media.caption,
        width: media.width,
        height: media.height,
        isCover: item.isCover,
        sortOrder: item.sortOrder,
        author: media.author,
        license: media.license,
        sourceUrl: media.sourceUrl,
        src: media.src,
      }
    })
  },
})
