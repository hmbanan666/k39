import { db } from '@k39/database'
import { z } from 'zod'
import { eventFormTiming, eventUpcoming } from '../../../shared/events'
import { practicalTarget } from '../../utils/practical/target'

export default defineMcpTool({
  name: 'events_list',
  description: 'List events (ADR 0046), soonest first. Filter by a place or venue (subjectType with subjectId or slug), or set upcoming true for rows that are not cancelled, not expired, and not past. Each row names its subject.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    subjectType: z.enum(['place', 'venue']).optional(),
    subjectId: z.string().optional(),
    slug: z.string().optional(),
    upcoming: z.boolean().optional(),
    limit: z.number().int().min(1).max(500).optional(),
  },
  handler: async ({ subjectType, subjectId, slug, upcoming, limit }) => {
    const now = new Date()
    const target = subjectType && (subjectId || slug) ? await practicalTarget(subjectType, subjectId, slug) : null
    const rows = await db.calendarEvents.list({
      subjectType: target?.type ?? subjectType,
      subjectId: target?.id,
      upcomingAt: upcoming ? now.toISOString() : undefined,
      limit,
    })
    const subjects = new Map<string, { slug: string, title: string, status: string }>()
    for (const type of ['place', 'venue']) {
      const found = await db.practicalSubjects(type, rows.filter((row) => row.subjectType === type).map((row) => row.subjectId))
      for (const [key, value] of found) {
        subjects.set(`${type}:${key}`, value)
      }
    }
    return {
      items: rows.map((row) => ({
        ...row,
        local: eventFormTiming(row),
        shown: eventUpcoming(row, now),
        subject: subjects.get(`${row.subjectType}:${row.subjectId}`) ?? null,
      })),
    }
  },
})
