import { PERSONAS } from '../../../shared/personas'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'personas_list',
  description:
    'List the visitor personas (ADR 0024): code, title, job, the questions a page must answer for them, and the modules they need. Use the codes with page_personas_set.',
  annotations: { readOnlyHint: true },
  inputSchema: {},
  handler: async () => ({ personas: PERSONAS }),
})
