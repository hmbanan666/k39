import type { ContentTx } from './content'
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import { useDatabase } from '../database'
import { contentDrafts, notices, places, venues } from '../tables'

export type NoticeSubjectType = 'place' | 'venue'
export type NoticeKind = 'relocation' | 'closed' | 'renovation' | 'other'
export type NoticeRow = typeof notices.$inferSelect

/** One row of a `notices_set` list after the web app validated it. */
export interface NoticeWrite {
  id?: string
  kind: NoticeKind
  startsOn: string
  endsOn: string | null
  openEndedReason: string | null
  text: string
  address: string | null
  sourceUrl: string
  sourceTitle: string
  checkedAt: string
}

export interface NoticeListFilter {
  subjectType?: NoticeSubjectType
  /** Only rows whose last day is before `today`. */
  expired?: boolean
  /** `YYYY-MM-DD` in Europe/Kaliningrad. */
  today: string
}

const ORDER = [asc(notices.startsOn), asc(notices.createdAt)]

/** Keys a notices write adds to a pending `content_drafts` payload. */
export const NOTICE_DRAFT_KEYS: readonly string[] = ['notices', 'noticesStagedAt']

export class Notices {
  static async forSubject(subjectType: NoticeSubjectType, subjectId: string, tx?: ContentTx) {
    return (tx ?? useDatabase()).select().from(notices).where(and(
      eq(notices.subjectType, subjectType),
      eq(notices.subjectId, subjectId),
    )).orderBy(...ORDER)
  }

  /**
   * Rows that can still be shown on `today` or later: the last day is today
   * or later, or there is no last day. `expired_at` is not read, so a missed
   * nightly job cannot keep a row on the page.
   */
  static async notEndedFor(subjectType: NoticeSubjectType, subjectIds: string[], today: string) {
    const ids = [...new Set(subjectIds)]
    if (!ids.length) {
      return []
    }
    return useDatabase().select().from(notices).where(and(
      eq(notices.subjectType, subjectType),
      inArray(notices.subjectId, ids),
      or(isNull(notices.endsOn), gte(notices.endsOn, today)),
    )).orderBy(...ORDER)
  }

  /** Every row with the subject slug and title, for `notices_list`. */
  static async list(filter: NoticeListFilter) {
    const where = and(
      filter.subjectType ? eq(notices.subjectType, filter.subjectType) : undefined,
      filter.expired === true ? and(isNotNull(notices.endsOn), lt(notices.endsOn, filter.today)) : undefined,
      filter.expired === false ? or(isNull(notices.endsOn), gte(notices.endsOn, filter.today)) : undefined,
    )
    const database = useDatabase()
    return database
      .select({
        notice: notices,
        subjectSlug: sql<string | null>`coalesce(${places.slug}, ${venues.slug})`,
        subjectTitle: sql<string | null>`coalesce(${places.title}, ${venues.name})`,
      })
      .from(notices)
      .leftJoin(places, and(eq(notices.subjectType, 'place'), eq(places.id, notices.subjectId)))
      .leftJoin(venues, and(eq(notices.subjectType, 'venue'), eq(venues.id, notices.subjectId)))
      .where(where)
      .orderBy(asc(notices.subjectType), asc(notices.subjectId), ...ORDER)
  }

  /**
   * Replaces the list of one subject. A row with a stored `id` of this
   * subject is updated, any other row is inserted, and a stored row missing
   * from `rows` is deleted. `expired_at` is cleared when the last day changes.
   */
  static async replace(subjectType: NoticeSubjectType, subjectId: string, rows: NoticeWrite[], tx?: ContentTx) {
    const write = async (run: ContentTx) => {
      const stored = await Notices.forSubject(subjectType, subjectId, run)
      const byId = new Map(stored.map((row) => [row.id, row]))
      const kept = new Set(rows.flatMap((row) => row.id && byId.has(row.id) ? [row.id] : []))
      const gone = stored.filter((row) => !kept.has(row.id)).map((row) => row.id)
      if (gone.length) {
        await run.delete(notices).where(inArray(notices.id, gone))
      }
      const now = new Date().toISOString()
      for (const row of rows) {
        const values = {
          kind: row.kind,
          startsOn: row.startsOn,
          endsOn: row.endsOn,
          openEndedReason: row.openEndedReason,
          text: row.text,
          address: row.address,
          sourceUrl: row.sourceUrl,
          sourceTitle: row.sourceTitle,
          checkedAt: row.checkedAt,
        }
        const current = row.id ? byId.get(row.id) : undefined
        if (current) {
          await run.update(notices).set({
            ...values,
            updatedAt: now,
            expiredAt: current.endsOn === row.endsOn ? current.expiredAt : null,
          }).where(eq(notices.id, current.id))
        } else {
          await run.insert(notices).values({ ...values, subjectType, subjectId })
        }
      }
      return Notices.forSubject(subjectType, subjectId, run)
    }
    return tx ? write(tx) : useDatabase().transaction(write)
  }

  /**
   * Writes a staged list from `content_drafts` (ADR 0049) and removes the
   * `notices` keys from that draft, in one transaction. The draft must still
   * have the id and `updated_at` that were read. A draft left with no other
   * key is deleted. Null when that draft changed or is gone.
   */
  static async applyStaged(subjectType: NoticeSubjectType, subjectId: string, stamp: { id: string, updatedAt: string }, rows: NoticeWrite[]) {
    return useDatabase().transaction(async (tx) => {
      const [draft] = await tx.select().from(contentDrafts).where(and(
        eq(contentDrafts.id, stamp.id),
        eq(contentDrafts.entityType, subjectType),
        eq(contentDrafts.entityId, subjectId),
        eq(contentDrafts.updatedAt, stamp.updatedAt),
      )).limit(1).for('update')
      if (!draft) {
        return null
      }
      const saved = await Notices.replace(subjectType, subjectId, rows, tx)
      const rest = Object.fromEntries(Object.entries(draft.payload).filter(([key]) => !NOTICE_DRAFT_KEYS.includes(key)))
      if (Object.keys(rest).length) {
        await tx.update(contentDrafts).set({ payload: rest, updatedAt: new Date().toISOString() }).where(eq(contentDrafts.id, draft.id))
      } else {
        await tx.delete(contentDrafts).where(eq(contentDrafts.id, draft.id))
      }
      return saved
    })
  }

  /** Flags rows whose last day is before `today`. Does not delete. */
  static async flagExpired(today: string) {
    const rows = await useDatabase().update(notices).set({ expiredAt: new Date().toISOString() }).where(and(
      isNull(notices.expiredAt),
      isNotNull(notices.endsOn),
      lt(notices.endsOn, today),
    )).returning({ id: notices.id })
    return rows.length
  }

  static async removeForSubject(subjectType: NoticeSubjectType, subjectId: string, tx?: ContentTx) {
    await (tx ?? useDatabase()).delete(notices).where(and(
      eq(notices.subjectType, subjectType),
      eq(notices.subjectId, subjectId),
    ))
  }
}
