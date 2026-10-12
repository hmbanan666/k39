import { db } from '@k39/database'
import { requireEditor } from '../../utils/access'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  return { consents: await db.consent.list() }
})
