import { listHubs } from '../../utils/mcp/hubs'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'hubs_list',
  description:
    'List place hubs (categories) with slug, title, description, markdown body, and SEO fields. renderedFields lists what the hub page shows. body is the article.',
  annotations: { readOnlyHint: true },
  inputSchema: {},
  handler: async () => listHubs(),
})
