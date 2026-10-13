import { db } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'media_attach_to_collection',
  description: 'Attach a stored photo to a collection or month guide, or update its cover flag, sort order, caption, and focal point (0 to 1). The first photo of a collection becomes its cover.',
  inputSchema: {
    collectionId: z.string(),
    mediaId: z.string(),
    isCover: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    caption: z.string().nullable().optional(),
    focalX: z.number().min(0).max(1).optional(),
    focalY: z.number().min(0).max(1).optional(),
  },
  handler: async (input) => {
    const media = await db.editor.mediaById(input.mediaId)
    if (!media) {
      throw createError({ statusCode: 404, statusMessage: 'Фото не найдено' })
    }
    const row = await db.editor.attachCollectionMedia(input.collectionId, input.mediaId, {
      isCover: input.isCover,
      sortOrder: input.sortOrder,
    })
    if (input.caption !== undefined || input.focalX !== undefined || input.focalY !== undefined) {
      await db.editor.updateMedia(input.mediaId, {
        caption: input.caption,
        focalX: input.focalX,
        focalY: input.focalY,
      })
    }
    await auditMcp('media_attach_to_collection', 'collection', input.collectionId)
    return { collectionId: input.collectionId, mediaId: input.mediaId, isCover: Boolean(row?.isCover), sortOrder: row?.sortOrder }
  },
})
