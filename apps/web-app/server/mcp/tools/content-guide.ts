import { CONTENT_GUIDE } from '../../utils/mcp/guide'

export default defineMcpTool({
  name: 'content_guide',
  description: 'Style and SEO rules for writing K39 place pages in Russian, including when an agent may publish.',
  annotations: { readOnlyHint: true },
  inputSchema: {},
  handler: async () => CONTENT_GUIDE,
})
