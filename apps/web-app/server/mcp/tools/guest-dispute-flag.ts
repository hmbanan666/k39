import { z } from 'zod'
import { requireEditorContent } from '../../utils/access'
import { moderateGuest } from '../../utils/guests/moderate'
import { auditMcp } from '../../utils/mcp/audit'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'guest_dispute_flag',
  description:
    'Flag a pending guest submission as disputed and leave it pending (ADR 0040). Editor token only. Use it when you cannot tell a real visit note from spam, or whether a photo is this place, or a rights complaint is already attached. The owner decides it in /admin/guests. A clear price report is not a dispute. Same writer as /admin/guests. Writes an mcp_audits row.',
  inputSchema: {
    id: z.string(),
  },
  handler: async ({ id }) => {
    requireEditorContent('flag a guest dispute')
    const result = await moderateGuest({
      id,
      actorId: null,
      decision: 'dispute',
    })
    await auditMcp('guest_dispute_flag', 'guest_submission', id)
    return result
  },
})
