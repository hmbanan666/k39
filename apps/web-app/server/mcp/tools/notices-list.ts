import { db } from '@k39/database'
import { z } from 'zod'
import { NOTICE_SUBJECT_TYPES, noticeToday } from '../../../shared/notices'
import { auditMcp } from '../../utils/mcp/audit'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { storedNotice } from '../../utils/notices/write'

export default defineStrictMcpTool({
  name: 'notices_list',
  description: 'List dated temporary notices across places and venues (ADR 0049). expired: true returns rows whose last day is before today in Europe/Kaliningrad: they are already hidden on the page, and this list is the cleanup (then notices_set without those rows). It is not queue_list. needsCheck: true returns open-ended rows checked more than 30 days ago; they still show until someone sets to or removes them. Each row carries subjectType, subjectId, subjectSlug, subjectTitle, and the notices_get fields.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    subjectType: z.enum(NOTICE_SUBJECT_TYPES).optional(),
    expired: z.boolean().optional(),
    needsCheck: z.boolean().optional(),
  },
  handler: async ({ subjectType, expired, needsCheck }) => {
    const today = noticeToday(new Date())
    const rows = await db.notices.list({ subjectType, expired, today })
    const items = rows.map((row) => ({
      subjectType: row.notice.subjectType,
      subjectId: row.notice.subjectId,
      subjectSlug: row.subjectSlug,
      subjectTitle: row.subjectTitle,
      ...storedNotice(row.notice, today),
    })).filter((item) => needsCheck == null || item.needsCheck === needsCheck)
    await auditMcp('notices_list', subjectType ?? null, null)
    return { today, items }
  },
})
