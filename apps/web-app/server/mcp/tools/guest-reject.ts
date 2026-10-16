import { z } from 'zod'
import { requireEditorContent } from '../../utils/access'
import { moderateGuest } from '../../utils/guests/moderate'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'guest_reject',
  description: 'Reject a pending guest submission. reason is stored for the author and is not public (ADR 0040). Editor token only. Use it for spam, advertising, illegal content, a copied page, a photo of somewhere else, or a recognizable face. Same writer as /admin/guests. A rejected photo file is deleted. Writes an mcp_audits row.',
  inputSchema: {
    id: z.string(),
    reason: z.string().trim().min(1).max(500),
  },
  handler: async ({ id, reason }) => {
    requireEditorContent('reject a guest submission')
    const result = await moderateGuest({
      id,
      actorId: null,
      decision: 'reject',
      note: reason,
    })
    await auditMcp('guest_reject', 'guest_submission', id)
    return result
  },
})
