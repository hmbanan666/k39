import { requireEditor } from '../../../utils/access'
import { acceptGuest, disputeGuest, rejectGuest } from '../../../utils/guests/moderate'

export default defineEventHandler(async (event) => {
  const editor = await requireEditor(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await readBody<{ decision?: string, note?: string }>(event)
  if (body.decision === 'accept') {
    return acceptGuest(id, editor.id)
  }
  if (body.decision === 'reject') {
    return rejectGuest(id, editor.id, body.note || '')
  }
  if (body.decision === 'dispute') {
    return disputeGuest(id, editor.id)
  }
  throw createError({ statusCode: 400, statusMessage: 'Нужно принять, отклонить или отметить спор.' })
})
