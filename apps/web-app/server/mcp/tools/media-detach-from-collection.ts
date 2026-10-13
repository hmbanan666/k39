import { db } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'media_detach_from_collection',
  description: 'Remove a photo from a collection gallery. The stored photo is kept. If it was the cover, the next photo becomes the cover.',
  inputSchema: {
    collectionId: z.string(),
    mediaId: z.string(),
  },
  handler: async (input) => {
    const removed = await db.editor.detachCollectionMedia(input.collectionId, input.mediaId)
    if (!removed) {
      throw createError({ statusCode: 404, statusMessage: 'Фото не привязано к подборке' })
    }
    await auditMcp('media_detach_from_collection', 'collection', input.collectionId)
    return { collectionId: input.collectionId, mediaId: input.mediaId, removed: true }
  },
})
