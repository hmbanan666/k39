import type { NoticeSubjectType, NoticeWindow, PublicNotice } from '../../../shared/notices'
import { db } from '@k39/database'
import { noticeToday, statusWindows, visibleNotices } from '../../../shared/notices'
import { toNoticeValue } from './write'

/**
 * The notices each subject shows on this request (ADR 0049): current and
 * upcoming, in display order. The window is compared with today in
 * Europe/Kaliningrad here, not through `expired_at`.
 */
export async function loadPublicNotices(subjectType: NoticeSubjectType, ids: string[], now = new Date()) {
  const today = noticeToday(now)
  const rows = await db.notices.notEndedFor(subjectType, ids, today)
  const bySubject = new Map<string, PublicNotice[]>()
  for (const id of new Set(ids)) {
    const own = rows.filter((row) => row.subjectId === id).map(toNoticeValue)
    bySubject.set(id, visibleNotices(own, today))
  }
  return bySubject
}

/** The status windows a venue card needs. Upcoming rows ride along so the chip flips on `from` without a reload. */
export async function loadNoticeWindows(subjectType: NoticeSubjectType, ids: string[], now = new Date()) {
  const shown = await loadPublicNotices(subjectType, ids, now)
  const windows = new Map<string, NoticeWindow[]>()
  for (const [id, rows] of shown) {
    windows.set(id, statusWindows(rows))
  }
  return windows
}

/**
 * The page's stored sources plus each shown notice's source, for the
 * collapsed «Источники» list of this response. The notice link goes away
 * with the notice unless the page already stored it.
 */
export function sourcesWithNotices(sources: Array<{ title: string, url: string }>, notices: PublicNotice[]) {
  const seen = new Set(sources.map((row) => row.url))
  const extra = notices.flatMap((row) => {
    if (seen.has(row.sourceUrl)) {
      return []
    }
    seen.add(row.sourceUrl)
    return [{ title: row.sourceTitle, url: row.sourceUrl }]
  })
  return [...sources, ...extra]
}
