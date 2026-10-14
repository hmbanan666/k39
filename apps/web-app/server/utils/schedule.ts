import type { ScheduleRecord, ScheduleRules } from '~~/shared/schedule'
import { db } from '@k39/database'
import { addDays, expandIntervals, localNow, readRules } from '~~/shared/schedule'

// Materialised window (ADR 0028): yesterday to 30 days ahead, so overnight
// intervals that started yesterday still answer "open now".
export const WINDOW_DAYS = 31

function intervalsFor(rules: ScheduleRules, at = new Date()) {
  const from = addDays(localNow(at).date, -1)
  return expandIntervals(rules, from, WINDOW_DAYS + 1).map((item) => ({
    startsAt: item.start.toISOString(),
    endsAt: item.end.toISOString(),
    lastEntryAt: item.lastEntry ? item.lastEntry.toISOString() : null,
  }))
}

export async function saveSchedule(entityType: string, entityId: string, record: ScheduleRecord) {
  return db.schedules.save({
    entityType,
    entityId,
    rules: record.rules as unknown as Record<string, unknown>,
    sourceUrl: record.sourceUrl,
    verifiedAt: record.verifiedAt,
  }, intervalsFor(record.rules))
}

export async function loadSchedule(entityType: string, entityId: string): Promise<ScheduleRecord | null> {
  const row = await db.schedules.get(entityType, entityId)
  const rules = row ? readRules(row.rules) : null
  return row && rules ? { rules, sourceUrl: row.sourceUrl, verifiedAt: row.verifiedAt } : null
}

/** Daily job: slide every window forward. */
export async function refreshScheduleIntervals() {
  const rows = await db.schedules.list()
  let count = 0
  for (const row of rows) {
    const rules = readRules(row.rules)
    if (!rules) {
      continue
    }
    await db.schedules.save({ entityType: row.entityType, entityId: row.entityId, rules: row.rules as Record<string, unknown>, sourceUrl: row.sourceUrl, verifiedAt: row.verifiedAt }, intervalsFor(rules))
    count += 1
  }
  return count
}
