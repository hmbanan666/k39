import { requireAccount } from '../../../utils/cabinet/account'
import { saveOwnerVenue } from '../../../utils/cabinet/flow'

export default defineEventHandler(async (event) => {
  const user = await requireAccount(event)
  const body = await readBody(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Нужны поля страницы' })
  }
  return saveOwnerVenue(user.id, getRouterParam(event, 'id') || '', body as Record<string, unknown>)
})
