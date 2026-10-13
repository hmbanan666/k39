import { db } from '@k39/database'
import { requireEditor } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const result = await db.venues.list({ page: 1, pageSize: 200 })
  return result.items
})
