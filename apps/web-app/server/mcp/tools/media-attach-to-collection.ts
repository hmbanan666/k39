import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'
import { attachCollectionPhoto } from '../../utils/mcp/photos'

export default defineMcpTool({
  name: 'media_attach_to_collection',
  description: 'Attach a stored photo to a collection or month guide, or update its cover flag, sort order, caption, and focal point (0 to 1). The first photo of a collection becomes its cover. A draft token cannot change the gallery of a published or archived collection. That answer is 409 and the live page stays.',
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
    const result = await attachCollectionPhoto(input)
    await auditMcp('media_attach_to_collection', 'collection', input.collectionId)
    return result
  },
})
