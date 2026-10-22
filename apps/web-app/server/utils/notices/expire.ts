import { db } from '@k39/database'
import { noticeToday } from '../../../shared/notices'

/**
 * Nightly flag (ADR 0049): sets `expired_at` on rows whose last day is
 * before today in Europe/Kaliningrad. Does not delete. The public page
 * already hides those rows on its own; `notices_list` with `expired: true`
 * is the cleanup list.
 */
export async function flagExpiredNotices(now = new Date()) {
  const today = noticeToday(now)
  const claimed = await db.analytics.claimRun(today, 'notice-expire')
  if (!claimed) {
    return { skipped: true, flagged: 0 }
  }
  return { skipped: false, flagged: await db.notices.flagExpired(today) }
}
