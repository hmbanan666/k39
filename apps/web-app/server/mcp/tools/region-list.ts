import { listRegions } from '../../utils/mcp/regions'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'region_list',
  description: 'List regions. Each row has slug, name (the title), and an optional center { latitude, longitude }. coordinates is the same point.',
  annotations: { readOnlyHint: true },
  inputSchema: {},
  handler: async () => listRegions(),
})
