import { z } from 'zod'
import { describeSchedule, statusFromRules } from '../../../shared/schedule'
import { scheduleTarget } from '../../utils/mcp/schedule-target'
import { defineStrictMcpTool } from '../../utils/mcp/tool'
import { loadSchedule } from '../../utils/schedule'

export default defineStrictMcpTool({
  name: 'schedule_get',
  description: 'Load the schedule (opening rules, source, verification date) of a place or venue, with its human text and current status. No schedule means hours are unknown.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    entityType: z.enum(['place', 'venue']).default('place'),
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async ({ entityType, id, slug }) => {
    const target = await scheduleTarget(entityType, id, slug)
    const record = await loadSchedule(entityType, target.id)
    const now = new Date()
    return {
      entityType,
      id: target.id,
      slug: target.slug,
      schedule: record,
      text: record ? describeSchedule(record.rules) : [],
      status: statusFromRules(record, now),
    }
  },
})
