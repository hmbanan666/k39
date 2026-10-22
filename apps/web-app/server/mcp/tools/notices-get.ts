import { z } from 'zod'
import { NOTICE_SUBJECT_TYPES } from '../../../shared/notices'
import { auditMcp } from '../../utils/mcp/audit'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { noticesView } from '../../utils/notices/write'
import { practicalTarget } from '../../utils/practical/target'

export default defineStrictMcpTool({
  name: 'notices_get',
  description: 'Load the dated temporary notices of a place or venue (ADR 0049): relocation, closed, renovation, other. Each row has id, kind, from, to (inclusive), openEndedReason, text, address, sourceUrl, sourceTitle, checkedAt, state (current, upcoming, expired on today in Europe/Kaliningrad), expiredAt (the nightly cleanup flag), and needsCheck (open-ended and checked more than 30 days ago). pendingReview is the list a draft-token write staged on the pending draft, or null. A notice is not a fact and not hours.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    subjectType: z.enum(NOTICE_SUBJECT_TYPES),
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async ({ subjectType, id, slug }) => {
    const target = await practicalTarget(subjectType, id, slug)
    const view = await noticesView(target)
    await auditMcp('notices_get', target.type, target.id)
    return { subjectType: target.type, id: target.id, slug: target.slug, status: target.status, ...view }
  },
})
