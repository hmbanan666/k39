import { z } from 'zod'
import { requireEditorContent } from '../../utils/access'
import { moderateGuest } from '../../utils/guests/moderate'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'guest_approve',
  description: 'Accept a pending guest submission with the same writer as /admin/guests (ADR 0040). Editor token only. recognizableFace is required. true on a photo rejects it and deletes the file; a face is never published, even if the guest says the person agreed. false accepts a photo only when you have seen the frame and it has no recognizable face. Non-photo rows ignore the flag. A correction only queues guest_report. Writes an mcp_audits row.',
  inputSchema: {
    id: z.string(),
    recognizableFace: z.boolean(),
  },
  handler: async ({ id, recognizableFace }) => {
    requireEditorContent('approve a guest submission')
    const result = await moderateGuest({
      id,
      actorId: null,
      decision: 'accept',
      recognizableFace,
    })
    await auditMcp('guest_approve', 'guest_submission', id)
    return result
  },
})
