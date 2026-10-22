import { and, asc, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { admissionPrices, calendarEvents, places, routes, venues } from '../tables'

export type AdmissionSubjectType = 'place' | 'venue' | 'route'
export type EventSubjectType = 'place' | 'venue'
export type AdmissionAudience = 'general' | 'reduced' | 'family' | 'foreign' | 'free'

export interface AdmissionRowWrite {
  slot: string
  audience: AdmissionAudience
  priceRub: number
  condition: string | null
  label: string | null
  sourceUrl: string
  sourceTitle: string
  checkedAt: string
  sortOrder: number
}

export interface CalendarEventWrite {
  subjectType: EventSubjectType
  subjectId: string
  title: string
  startsAt: string
  endsAt: string | null
  allDay: boolean
  ticketUrl: string | null
  sourceUrl: string
  sourceTitle: string
  checkedAt: string
}

/** An event is past when its end, or its start when it has no end, is not after `now`. */
function liveAt(now: string) {
  return and(
    isNull(calendarEvents.cancelledAt),
    isNull(calendarEvents.expiredAt),
    gt(sql`coalesce(${calendarEvents.endsAt}, ${calendarEvents.startsAt})`, now),
  )
}

// Admission prices (ADR 0046). The writer in the web app owns validation and facts.
export class Admission {
  static async forSubject(subjectType: string, subjectId: string) {
    return useDatabase().select().from(admissionPrices).where(and(eq(admissionPrices.subjectType, subjectType), eq(admissionPrices.subjectId, subjectId))).orderBy(asc(admissionPrices.sortOrder), asc(admissionPrices.slot))
  }

  static async forSubjects(subjectType: string, subjectIds: string[]) {
    if (!subjectIds.length) {
      return []
    }
    return useDatabase().select().from(admissionPrices).where(and(eq(admissionPrices.subjectType, subjectType), inArray(admissionPrices.subjectId, subjectIds))).orderBy(asc(admissionPrices.sortOrder), asc(admissionPrices.slot))
  }

  static async list(subjectType?: string) {
    const query = useDatabase().select().from(admissionPrices)
    const filtered = subjectType ? query.where(eq(admissionPrices.subjectType, subjectType)) : query
    return filtered.orderBy(asc(admissionPrices.subjectType), asc(admissionPrices.subjectId), asc(admissionPrices.sortOrder))
  }

  /** Replaces the whole list of one subject in a transaction. */
  static async replace(subjectType: AdmissionSubjectType, subjectId: string, rows: AdmissionRowWrite[]) {
    await useDatabase().transaction(async (tx) => {
      await tx.delete(admissionPrices).where(and(eq(admissionPrices.subjectType, subjectType), eq(admissionPrices.subjectId, subjectId)))
      if (rows.length) {
        await tx.insert(admissionPrices).values(rows.map((row) => ({ ...row, subjectType, subjectId })))
      }
    })
    return Admission.forSubject(subjectType, subjectId)
  }

  static async removeForSubject(subjectType: string, subjectId: string) {
    await useDatabase().delete(admissionPrices).where(and(eq(admissionPrices.subjectType, subjectType), eq(admissionPrices.subjectId, subjectId)))
  }
}

// Dated events (ADR 0046). Retired rows stay for the revision history.
export class CalendarEvents {
  static async byId(id: string) {
    const [row] = await useDatabase().select().from(calendarEvents).where(eq(calendarEvents.id, id)).limit(1)
    return row ?? null
  }

  static async forSubject(subjectType: string, subjectId: string) {
    return useDatabase().select().from(calendarEvents).where(and(eq(calendarEvents.subjectType, subjectType), eq(calendarEvents.subjectId, subjectId))).orderBy(asc(calendarEvents.startsAt))
  }

  /** Not cancelled, not expired, and not past at `now`. The read compares time itself. */
  static async upcomingFor(subjectType: string, subjectIds: string[], now: string, limit: number) {
    if (!subjectIds.length) {
      return []
    }
    return useDatabase().select().from(calendarEvents).where(and(eq(calendarEvents.subjectType, subjectType), inArray(calendarEvents.subjectId, subjectIds), liveAt(now))).orderBy(asc(calendarEvents.startsAt), asc(calendarEvents.title)).limit(limit)
  }

  /** Upcoming events of published places, with the place for the link. */
  static async upcomingForPlaces(placeIds: string[], now: string, limit: number) {
    if (!placeIds.length) {
      return []
    }
    return useDatabase().select({
      event: calendarEvents,
      subjectSlug: places.slug,
      subjectTitle: places.title,
    }).from(calendarEvents).innerJoin(places, eq(places.id, calendarEvents.subjectId)).where(and(
      eq(calendarEvents.subjectType, 'place'),
      inArray(calendarEvents.subjectId, placeIds),
      eq(places.publicationStatus, 'published'),
      liveAt(now),
    )).orderBy(asc(calendarEvents.startsAt), asc(calendarEvents.title)).limit(limit)
  }

  static async list(filter: { subjectType?: string, subjectId?: string, upcomingAt?: string, limit?: number } = {}) {
    const conditions = [
      filter.subjectType ? eq(calendarEvents.subjectType, filter.subjectType) : undefined,
      filter.subjectId ? eq(calendarEvents.subjectId, filter.subjectId) : undefined,
      filter.upcomingAt ? liveAt(filter.upcomingAt) : undefined,
    ].filter((item) => item !== undefined)
    return useDatabase().select().from(calendarEvents).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(calendarEvents.startsAt)).limit(Math.min(Math.max(filter.limit ?? 100, 1), 500))
  }

  static async insert(row: CalendarEventWrite) {
    const [saved] = await useDatabase().insert(calendarEvents).values(row).returning()
    return saved!
  }

  static async update(id: string, row: Omit<CalendarEventWrite, 'subjectType' | 'subjectId'>) {
    const [saved] = await useDatabase().update(calendarEvents).set({ ...row, updatedAt: new Date().toISOString() }).where(eq(calendarEvents.id, id)).returning()
    return saved ?? null
  }

  static async cancel(id: string, at: string) {
    const [saved] = await useDatabase().update(calendarEvents).set({ cancelledAt: at, updatedAt: at }).where(and(eq(calendarEvents.id, id), isNull(calendarEvents.cancelledAt))).returning()
    return saved ?? null
  }

  /** Live rows whose end (or start without an end) is at or before `now`. */
  static async due(now: string) {
    return useDatabase().select().from(calendarEvents).where(and(
      isNull(calendarEvents.cancelledAt),
      isNull(calendarEvents.expiredAt),
      lte(sql`coalesce(${calendarEvents.endsAt}, ${calendarEvents.startsAt})`, now),
    ))
  }

  static async markExpired(ids: string[], at: string) {
    if (!ids.length) {
      return
    }
    await useDatabase().update(calendarEvents).set({ expiredAt: at, updatedAt: at }).where(and(inArray(calendarEvents.id, ids), isNull(calendarEvents.expiredAt)))
  }

  static async removeForSubject(subjectType: string, subjectId: string) {
    await useDatabase().delete(calendarEvents).where(and(eq(calendarEvents.subjectType, subjectType), eq(calendarEvents.subjectId, subjectId)))
  }
}

/** Slug, title, and live status of practical-info subjects, for the list tools and the admin. */
export async function practicalSubjects(subjectType: string, ids: string[]) {
  const unique = [...new Set(ids)]
  if (!unique.length) {
    return new Map<string, { slug: string, title: string, status: string }>()
  }
  const db = useDatabase()
  const rows = subjectType === 'venue'
    ? await db.select({ id: venues.id, slug: venues.slug, title: venues.name, status: venues.status }).from(venues).where(inArray(venues.id, unique))
    : subjectType === 'route'
      ? await db.select({ id: routes.id, slug: routes.slug, title: routes.title, status: routes.publicationStatus }).from(routes).where(inArray(routes.id, unique))
      : await db.select({ id: places.id, slug: places.slug, title: places.title, status: places.publicationStatus }).from(places).where(inArray(places.id, unique))
  return new Map(rows.map((row) => [row.id, { slug: row.slug, title: row.title, status: row.status }]))
}
