import { db } from '@k39/database'
import { requireEditor } from '../../../../utils/access'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }
  const row = await db.consent.withdraw(id)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Consent not found' })
  }
  return { id: row.id, withdrawnAt: row.withdrawnAt }
})
