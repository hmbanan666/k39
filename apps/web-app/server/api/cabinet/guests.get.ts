import { db } from '@k39/database'
import { requireAccount } from '../../utils/cabinet/account'

export default defineEventHandler(async (event) => {
  const user = await requireAccount(event)
  const rows = await db.guests.forUser(user.id)
  return {
    submissions: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      decidedAt: row.decidedAt,
      kind: row.kind,
      status: row.status,
      decisionNote: row.status === 'rejected' ? row.decisionNote : null,
      subjectTitle: row.placeTitle || row.venueName || 'Страница',
      subjectPath: row.placeSlug ? `/${row.placeSlug}` : row.venueSlug ? `/zavedeniya/${row.venueSlug}` : '',
    })),
  }
})
