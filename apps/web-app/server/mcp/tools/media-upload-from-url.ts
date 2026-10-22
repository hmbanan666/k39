import { z } from 'zod'
import { uploadMediaFromUrl } from '../../utils/mcp/media-import'
import { license } from '../../utils/mcp/schemas'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'media_upload_from_url',
  description: 'Download an https image from a public host, run the photo pipeline, and store it. Alt, author, license, and sourceUrl are required. License is own or a Commons license. permission is the cabinet owner upload only. url and sourceUrl must not name a banned site. A draft token cannot attach the file to a published or archived place or collection. That answer is 409 and the live page stays.',
  inputSchema: {
    url: z.string().describe('https URL of a JPEG, PNG, or WebP'),
    alt: z.string(),
    author: z.string(),
    license,
    sourceUrl: z.string(),
    caption: z.string().optional(),
    placeId: z.string().optional(),
    collectionId: z.string().optional().describe('Attach to a collection instead of a place'),
    isCover: z.boolean().optional(),
  },
  handler: async (input) => uploadMediaFromUrl(input),
})
