import { requireEditor } from '../../../utils/access'
import { decideClaim } from '../../../utils/cabinet/flow'

export default defineEventHandler(async (event) => {
  const admin = await requireEditor(event)
  const body = await readBody(event)
  if (body?.confirmed !== true) {
    throw createError({ statusCode: 400, statusMessage: 'Подтвердите, что заявка проверена' })
  }
  const decision = body?.decision
  if (decision !== 'approve' && decision !== 'reject') {
    throw createError({ statusCode: 400, statusMessage: 'Нужно решение' })
  }
  return decideClaim(admin.id, getRouterParam(event, 'id') || '', decision)
})
