import { z } from 'zod'
import { importCommonsPhoto } from '../../utils/mcp/media-import'
import { license } from '../../utils/mcp/schemas'

export default defineMcpTool({
  name: 'commons_import',
  description: 'Import one allowed Wikimedia Commons file into the photo pipeline and attach it to a place or a collection (pass exactly one of placeId or collectionId). The same pageUrl or fileUrl on that target returns the existing photo. The first photo on an empty target becomes the cover. A later import stays in the gallery unless isCover is true. caption is shown under the photo on collection pages. fileUrl, pageUrl, and caption must not name a banned site. A draft token cannot import onto a published or archived place or collection. That answer is 409 and the live page stays.',
  annotations: { openWorldHint: true },
  inputSchema: {
    placeId: z.string().optional(),
    collectionId: z.string().optional(),
    caption: z.string().optional(),
    fileUrl: z.string(),
    pageUrl: z.string(),
    alt: z.string(),
    author: z.string(),
    license,
    isCover: z.boolean().optional(),
  },
  handler: async (input) => importCommonsPhoto(input),
})
