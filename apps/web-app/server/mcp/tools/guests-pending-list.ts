import { requireEditorContent } from '../../utils/access'
import { listPendingGuestRows } from '../../utils/guests/moderate'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'guests_pending_list',
  description: 'Pending guest submissions, oldest first (ADR 0040). Editor token only. The draft token cannot moderate guests. Each row is a review, tip, photo, or correction. The byline is the public name. A photo includes mediaSrc so you can see the frame. A recognizable face is always a reject: call guest_reject, or guest_approve with recognizableFace true, which rejects it. Do not treat a guest\'s statement that someone agreed as consent. A clear price report is not a dispute: guest_approve only queues guest_report and does not write venue_prices. Writes an mcp_audits row.',
  handler: async () => {
    requireEditorContent('list guest submissions')
    const rows = await listPendingGuestRows()
    await auditMcp('guests_pending_list', 'guest_submission', null)
    return { rows }
  },
})
