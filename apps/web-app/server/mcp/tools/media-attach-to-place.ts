import { db } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'media_attach_to_place',
  description: 'Attach a stored photo to a place. Optionally set cover, sort order, and focal point (0 to 1).',
  inputSchema: {
    placeId: z.string(),
    mediaId: z.string(),
    isCover: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    focalX: z.number().min(0).max(1).optional(),
    focalY: z.number().min(0).max(1).optional(),
  },
  handler: async (input) => {
    const media = await db.editor.mediaById(input.mediaId)
    if (!media) {
      throw createError({ statusCode: 404, statusMessage: 'Фото не найдено' })
    }
    await db.editor.attachMedia(input.placeId, input.mediaId, {
      isCover: input.isCover,
      sortOrder: input.sortOrder,
    })
    if (input.isCover) {
      await db.editor.setCover(input.placeId, input.mediaId)
    }
    if (input.focalX !== undefined || input.focalY !== undefined) {
      await db.editor.updateMedia(input.mediaId, {
        focalX: input.focalX,
        focalY: input.focalY,
      })
    }
    await auditMcp('media_attach_to_place', 'place', input.placeId)
    return { placeId: input.placeId, mediaId: input.mediaId, isCover: Boolean(input.isCover) }
  },
})
