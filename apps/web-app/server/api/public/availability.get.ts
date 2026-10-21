import { db } from '@k39/database'
import { z } from 'zod'
import { availabilityFromWindow, availabilityText, readRules, scheduleRulesSchema } from '../../../shared/schedule'
import { unknownSpansFor } from '../../utils/schedule'

// One availability query for the map and lists (ADR 0028). Never cached:
// the answer depends on the minute.
const querySchema = z.object({
  at: z.string().datetime({ offset: true }).optional(),
  bbox: z.string().regex(/^-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?){3}$/).optional(),
  type: z.string().optional(),
  status: z.string().optional(),
})

function readClosure(value: unknown) {
  const parsed = scheduleRulesSchema.shape.closure.safeParse(value ?? undefined)
  return parsed.success ? parsed.data : undefined
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'no-store')
  const query = await getValidatedQuery(event, (value) => querySchema.parse(value))
  const at = query.at ? new Date(query.at) : new Date()
  const bbox = query.bbox ? query.bbox.split(',').map(Number) as [number, number, number, number] : null
  const types = query.type ? query.type.split(',').filter((item) => item === 'place' || item === 'venue') : undefined
  const wanted = query.status ? new Set(query.status.split(',')) : null
  const rows = await db.schedules.availability(at.toISOString(), { types, bbox })
  const items = rows.map((row) => {
    const verified = Boolean(row.verifiedAt) && !row.needsCheck
    const unknownRules = verified && row.unknownDayRules ? readRules(row.unknownDayRules) : null
    const unknownDays = unknownRules ? unknownSpansFor(unknownRules, at) : undefined
    const value = availabilityFromWindow({ currentEnd: row.currentEnd, currentStart: row.currentStart, currentOpenEnded: row.currentOpenEnded, nextStart: row.nextStart, verified, alwaysOpen: row.mode === 'always', appointment: row.mode === 'appointment', closed: row.mode === 'closed', closure: readClosure(row.closure), slot: row.mode === 'slots' ? row.slotLabel ?? 'Экскурсия' : undefined, unknownDays }, at)
    return {
      type: row.entityType,
      slug: row.slug,
      title: row.title,
      latitude: row.latitude,
      longitude: row.longitude,
      ...value,
      verified,
      text: availabilityText(value, at),
    }
  }).filter((item) => !wanted || wanted.has(item.status))
  return { at: at.toISOString(), items }
})
