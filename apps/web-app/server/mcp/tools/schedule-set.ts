import { db } from '@k39/database'
import { z } from 'zod'
import { describeSchedule, scheduleRulesSchema } from '../../../shared/schedule'
import { auditMcp } from '../../utils/mcp/audit'
import { scheduleTarget } from '../../utils/mcp/schedule-target'
import { saveSchedule } from '../../utils/schedule'

export default defineMcpTool({
  name: 'schedule_set',
  description: 'Write the schedule of a place or venue (ADR 0028) and rebuild its 30-day intervals. Take hours only from an official source and pass its URL; verifiedAt is the day you checked it. Without verifiedAt, or with rules.needsCheck, the site shows the text but never «открыто/закрыто» or markup. Pass remove=true to delete the schedule (hours become unknown). Writes an mcp_audits row.',
  inputSchema: {
    entityType: z.enum(['place', 'venue']).default('place'),
    id: z.string().optional(),
    slug: z.string().optional(),
    rules: scheduleRulesSchema.optional(),
    sourceUrl: z.string().url().nullable().optional(),
    verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    remove: z.boolean().optional(),
  },
  handler: async ({ entityType, id, slug, rules, sourceUrl, verifiedAt, remove }) => {
    const target = await scheduleTarget(entityType, id, slug)
    if (remove) {
      await db.schedules.remove(entityType, target.id)
      await auditMcp('schedule_set', entityType, target.id)
      return { ...target, removed: true }
    }
    if (!rules) {
      throw createError({ statusCode: 400, statusMessage: 'Нужны rules или remove' })
    }
    await saveSchedule(entityType, target.id, { rules, sourceUrl: sourceUrl ?? null, verifiedAt: verifiedAt ?? null })
    await auditMcp('schedule_set', entityType, target.id)
    return { ...target, text: describeSchedule(rules) }
  },
})
