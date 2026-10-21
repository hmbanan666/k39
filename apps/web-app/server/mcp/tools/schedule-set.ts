import { db } from '@k39/database'
import { z } from 'zod'
import { describeSchedule, scheduleRulesSchema } from '../../../shared/schedule'
import { retireFactSlot } from '../../utils/facts/commit'
import { auditMcp } from '../../utils/mcp/audit'
import { scheduleTarget } from '../../utils/mcp/schedule-target'
import { saveSchedule } from '../../utils/schedule'

export default defineMcpTool({
  name: 'schedule_set',
  description: 'Write the schedule of a place or venue (ADR 0028) and rebuild its 30-day intervals. Place hours come only from an official source. For a venue that really exists and operates, hours may also come from Yandex Maps, 2GIS, or OSM when the official site does not state them. Pass that URL as sourceUrl and record the same { title, url } in sources. Do not copy map text, reviews, ratings, or prices. verifiedAt is the day you checked it. A week entry is {days 0..6 Sunday first, opens, closes?, breaks?, lastEntry?}; closes at or before opens runs past midnight. Omit closes only when the source gives a start time and no closing time (ADR 0042): the site then says «с 12:00, закрытие уточняйте», reports open from opens until the end of that day, never a closing time, and emits no schema.org hours. On such an entry, breaks and lastEntry must fall after opens on the same day. Without verifiedAt, or with rules.needsCheck, the site shows the text but never «открыто/закрыто» or markup. Pass remove=true to delete the schedule (hours become unknown). Writes an mcp_audits row.',
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
      await retireFactSlot(entityType, target.id, 'hours')
      await auditMcp('schedule_set', entityType, target.id)
      return { ...target, removed: true }
    }
    if (!rules) {
      throw createError({ statusCode: 400, statusMessage: 'Нужны rules или remove' })
    }
    const saved = await saveSchedule(entityType, target.id, { rules, sourceUrl: sourceUrl ?? null, verifiedAt: verifiedAt ?? null }, { actor: 'mcp' })
    await auditMcp('schedule_set', entityType, target.id)
    if (saved.conflict) {
      return { ...target, conflict: true, queueId: saved.queueId, text: describeSchedule(rules) }
    }
    return { ...target, text: describeSchedule(rules) }
  },
})
