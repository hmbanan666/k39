import { db } from '@k39/database'
import { requireEditor } from '../../utils/access'
import { presentPending } from '../../utils/guests/moderate'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const [submissions, signals] = await Promise.all([db.guests.pendingQueue(), db.guests.openSectionSignals()])
  return {
    submissions: presentPending(submissions),
    signals: signals.map((row) => ({
      id: row.id,
      path: row.path,
      pageType: row.pageType,
      entityId: row.entityId,
      enqueuedAt: row.enqueuedAt,
      proposal: row.proposal,
    })),
  }
})
