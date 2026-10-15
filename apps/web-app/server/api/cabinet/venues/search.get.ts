import { db, kindLabel } from '@k39/database'
import { getQuery } from 'h3'
import { requireAccount } from '../../../utils/cabinet/account'
import { limitSearch } from '../../../utils/cabinet/rate'

export default defineEventHandler(async (event) => {
  const user = await requireAccount(event)
  limitSearch(user.id)
  const q = String(getQuery(event).q || '')
  const rows = await db.venues.searchPublic(q)
  return {
    venues: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      address: row.address,
      kind: row.kind,
      kindLabel: kindLabel(row.kind),
      status: row.status,
    })),
  }
})
