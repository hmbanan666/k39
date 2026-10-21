import type { FactActor } from '~~/shared/facts'
import type { ScheduleRecord, ScheduleRules } from '~~/shared/schedule'
import { db } from '@k39/database'
import { addDays, expandIntervals, localNow, readRules } from '~~/shared/schedule'
import { hoursConflict, writeHoursFact } from './facts/sync'
import { rejectBannedSites } from './mcp/writing-guard'

// Materialised window (ADR 0028): yesterday to 30 days ahead, so overnight
// intervals that started yesterday still answer "open now".
export const WINDOW_DAYS = 31

function intervalsFor(rules: ScheduleRules, at = new Date()) {
  const from = addDays(localNow(at).date, -1)
  return expandIntervals(rules, from, WINDOW_DAYS + 1).map((item) => ({
    startsAt: item.start.toISOString(),
    endsAt: item.end.toISOString(),
    lastEntryAt: item.lastEntry ? item.lastEntry.toISOString() : null,
    openEnded: Boolean(item.openEnded),
  }))
}

export async function saveSchedule(entityType: string, entityId: string, record: ScheduleRecord, options?: { actor?: FactActor, syncFacts?: boolean, pageStatus?: string | null }) {
  rejectBannedSites(record.sourceUrl)
  const syncFacts = options?.syncFacts !== false
  const actor = options?.actor ?? 'mcp'
  if (syncFacts && (entityType === 'place' || entityType === 'venue')) {
    const blocked = await hoursConflict(entityType, entityId, record, actor)
    if (blocked) {
      return { conflict: true as const, queueId: blocked.queueId }
    }
  }
  const saved = await db.schedules.save({
    entityType,
    entityId,
    rules: record.rules as unknown as Record<string, unknown>,
    sourceUrl: record.sourceUrl,
    verifiedAt: record.verifiedAt,
  }, intervalsFor(record.rules))
  if (syncFacts && (entityType === 'place' || entityType === 'venue')) {
    await writeHoursFact(entityType, entityId, record, actor, options?.pageStatus)
  }
  return { conflict: false as const, saved }
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
    await saveSchedule(row.entityType, row.entityId, { rules, sourceUrl: row.sourceUrl, verifiedAt: row.verifiedAt }, { syncFacts: false })
    count += 1
  }
  return count
}
