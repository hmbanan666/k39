import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'
import { detachCollectionPhoto } from '../../utils/mcp/photos'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'media_detach_from_collection',
  description: 'Remove a photo from a collection gallery. The stored photo is kept. If it was the cover, the next photo becomes the cover. A draft token cannot remove a photo from a published or archived collection. That answer is 409 and the live page stays.',
  inputSchema: {
    collectionId: z.string(),
    mediaId: z.string(),
  },
  handler: async (input) => {
    const result = await detachCollectionPhoto(input)
    await auditMcp('media_detach_from_collection', 'collection', input.collectionId)
    return result
  },
})
