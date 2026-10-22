import { db } from '@k39/database'
import { z } from 'zod'
import { eventFormTiming, eventUpcoming } from '../../../shared/events'
import { practicalTarget } from '../../utils/practical/target'

export default defineMcpTool({
  name: 'event_get',
  description: 'Load one event by id, or every event of a place or venue (ADR 0046), including cancelled and expired rows kept for history. Each row carries the local Kaliningrad timing in the event_upsert input shape and whether the page shows it.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    id: z.string().optional(),
    subjectType: z.enum(['place', 'venue']).default('place'),
    subjectId: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async ({ id, subjectType, subjectId, slug }) => {
    const now = new Date()
    const view = (row: NonNullable<Awaited<ReturnType<typeof db.calendarEvents.byId>>>) => ({ ...row, local: eventFormTiming(row), shown: eventUpcoming(row, now) })
    if (id) {
      const row = await db.calendarEvents.byId(id)
      if (!row) {
        throw createError({ statusCode: 404, statusMessage: 'Событие не найдено' })
      }
      return { event: view(row) }
    }
    const target = await practicalTarget(subjectType, subjectId, slug)
    const rows = await db.calendarEvents.forSubject(target.type, target.id)
    return { subjectType, id: target.id, slug: target.slug, status: target.status, events: rows.map(view) }
  },
})
