import { createError } from 'h3'
import { requireEditor } from '../../../../utils/access'
import { decideVenueDraft } from '../../../../utils/admin/venue-draft'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readJsonBody(event)
  if (body?.action !== 'apply' && body?.action !== 'discard') {
    throw createError({ statusCode: 400, statusMessage: 'Нужно действие: применить или отбросить' })
  }
  return decideVenueDraft(getRouterParam(event, 'id') || '', body.action, body.updatedAt)
})
