import { CONTENT_GUIDE } from '../../utils/mcp/guide'

export default defineMcpResource({
  name: 'content_guide',
  description: 'Style and SEO rules for writing K39 place pages in Russian.',
  uri: 'k39://content-guide',
  handler: async (uri: URL) => ({
    contents: [{ uri: uri.toString(), text: CONTENT_GUIDE, mimeType: 'text/plain' }],
  }),
})
