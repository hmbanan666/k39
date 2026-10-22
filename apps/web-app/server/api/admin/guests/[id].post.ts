import { requireEditor } from '../../../utils/access'
import { moderateGuest } from '../../../utils/guests/moderate'

export default defineEventHandler(async (event) => {
  const editor = await requireEditor(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await readJsonBody<{ decision?: string, note?: string }>(event)
  if (body.decision === 'accept' || body.decision === 'reject' || body.decision === 'dispute') {
    return moderateGuest({
      id,
      actorId: editor.id,
      decision: body.decision,
      note: body.note,
    })
  }
  throw createError({ statusCode: 400, statusMessage: 'Нужно принять, отклонить или отметить спор.' })
})
