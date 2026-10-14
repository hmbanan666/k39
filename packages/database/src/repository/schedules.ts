import { and, eq, inArray, sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { places, scheduleIntervals, schedules, venues } from '../tables'

export interface ScheduleRow {
  entityType: string
  entityId: string
  rules: Record<string, unknown>
  sourceUrl: string | null
  verifiedAt: string | null
}

export interface IntervalRow {
  startsAt: string
  endsAt: string
  lastEntryAt: string | null
}

export interface AvailabilityEntity {
  entityType: string
  entityId: string
  slug: string
  title: string
  latitude: number | null
  longitude: number | null
  verifiedAt: string | null
  needsCheck: boolean
  mode: string
  currentEnd: string | null
  nextStart: string | null
}

// Schedules and their materialised intervals (ADR 0028).
export class Schedules {
  static async get(entityType: string, entityId: string) {
    const [row] = await useDatabase().select().from(schedules).where(and(eq(schedules.entityType, entityType), eq(schedules.entityId, entityId))).limit(1)
    return row ?? null
  }

  static async forEntities(entityType: string, ids: string[]) {
    if (!ids.length) {
      return []
    }
    return useDatabase().select().from(schedules).where(and(eq(schedules.entityType, entityType), inArray(schedules.entityId, ids)))
  }

  static async list(entityType?: string) {
    const query = useDatabase().select().from(schedules)
    return entityType ? query.where(eq(schedules.entityType, entityType)) : query
  }

  /** Writes the rules and replaces the entity's intervals in one transaction. */
  static async save(row: ScheduleRow, intervals: IntervalRow[]) {
    return useDatabase().transaction(async (tx) => {
      const [saved] = await tx.insert(schedules).values({ ...row, updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: [schedules.entityType, schedules.entityId], set: { rules: row.rules, sourceUrl: row.sourceUrl, verifiedAt: row.verifiedAt, updatedAt: new Date().toISOString() } }).returning()
      await tx.delete(scheduleIntervals).where(and(eq(scheduleIntervals.entityType, row.entityType), eq(scheduleIntervals.entityId, row.entityId)))
      if (intervals.length) {
        await tx.insert(scheduleIntervals).values(intervals.map((item) => ({ entityType: row.entityType, entityId: row.entityId, ...item })))
      }
      return saved
    })
  }

  static async remove(entityType: string, entityId: string) {
    const db = useDatabase()
    await db.delete(scheduleIntervals).where(and(eq(scheduleIntervals.entityType, entityType), eq(scheduleIntervals.entityId, entityId)))
    await db.delete(schedules).where(and(eq(schedules.entityType, entityType), eq(schedules.entityId, entityId)))
  }

  /**
   * One query for the map and lists: every published place and venue with a
   * schedule, its current interval end (if open at `at`) and next start.
   */
  static async availability(at: string, options: { types?: string[], bbox?: [number, number, number, number] | null } = {}) {
    const types = options.types?.length ? options.types : ['place', 'venue']
    const box = options.bbox
    const result = await useDatabase().execute(sql`
      with entities as (
        select 'place' as entity_type, p.id as entity_id, p.slug, p.title, p.latitude, p.longitude
        from places p where p.publication_status = 'published'
        union all
        select 'venue', v.id, v.slug, v.name, v.latitude, v.longitude
        from venues v where v.status = 'published'
      )
      select e.entity_type, e.entity_id, e.slug, e.title, e.latitude, e.longitude,
        s.verified_at::text as verified_at,
        coalesce((s.rules->>'needsCheck')::boolean, false) as needs_check,
        coalesce(s.rules->>'mode', 'hours') as mode,
        (select i.ends_at from schedule_intervals i
          where i.entity_type = e.entity_type and i.entity_id = e.entity_id
            and i.starts_at <= ${at}::timestamptz and i.ends_at > ${at}::timestamptz
          order by i.ends_at desc limit 1) as current_end,
        (select i.starts_at from schedule_intervals i
          where i.entity_type = e.entity_type and i.entity_id = e.entity_id and i.starts_at > ${at}::timestamptz
          order by i.starts_at limit 1) as next_start
      from entities e
      join schedules s on s.entity_type = e.entity_type and s.entity_id = e.entity_id
      where e.entity_type in ${types}
        ${box ? sql`and e.longitude between ${box[0]} and ${box[2]} and e.latitude between ${box[1]} and ${box[3]}` : sql``}
    `)
    const rows = Array.isArray(result) ? result as Record<string, unknown>[] : (result as unknown as { rows?: Record<string, unknown>[] }).rows ?? []
    return rows.map((row): AvailabilityEntity => ({
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      slug: String(row.slug),
      title: String(row.title),
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
      verifiedAt: row.verified_at ? String(row.verified_at) : null,
      needsCheck: Boolean(row.needs_check),
      mode: String(row.mode),
      currentEnd: row.current_end ? new Date(String(row.current_end)).toISOString() : null,
      nextStart: row.next_start ? new Date(String(row.next_start)).toISOString() : null,
    }))
  }

  /** Places and venues with hours text, for the one-off migration into schedules. */
  static async migrationSources() {
    const db = useDatabase()
    const placeRows = await db.select({ id: places.id, slug: places.slug, hours: places.hours, verifiedAt: places.lastVerifiedAt }).from(places)
    const venueRows = await db.select({ id: venues.id, slug: venues.slug, hours: venues.hours, verifiedAt: venues.lastVerifiedAt }).from(venues)
    const existing = await db.select({ entityType: schedules.entityType, entityId: schedules.entityId }).from(schedules)
    return { placeRows, venueRows, existing: new Set(existing.map((row) => `${row.entityType}:${row.entityId}`)) }
  }
}
