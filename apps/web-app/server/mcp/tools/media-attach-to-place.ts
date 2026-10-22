import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'
import { attachPlacePhoto } from '../../utils/mcp/photos'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'media_attach_to_place',
  description: 'Attach a stored photo to a place. Optionally set cover, sort order, and focal point (0 to 1). A draft token cannot attach a photo to a published or archived place. That answer is 409 and the live page stays.',
  inputSchema: {
    placeId: z.string(),
    mediaId: z.string(),
    isCover: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    focalX: z.number().min(0).max(1).optional(),
    focalY: z.number().min(0).max(1).optional(),
  },
  handler: async (input) => {
    const result = await attachPlacePhoto(input)
    await auditMcp('media_attach_to_place', 'place', input.placeId)
    return result
  },
})
