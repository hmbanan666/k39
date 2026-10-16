import { db } from '@k39/database'
import { requireAccount } from '../../../../utils/cabinet/account'
import { removeGuestMedia } from '../../../../utils/guests/moderate'

export default defineEventHandler(async (event) => {
  const user = await requireAccount(event)
  const id = getRouterParam(event, 'id') || ''
  const cleared = await db.guests.removeOwn(id, user.id)
  if (!cleared) {
    throw createError({ statusCode: 404, statusMessage: 'Сообщение не найдено.' })
  }
  await removeGuestMedia([cleared.mediaId])
  return { id, status: 'removed' }
})
