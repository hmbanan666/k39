import { db } from '@k39/database'
import { deleteMediaCompletely } from '../../../../../media/ingest'
import { requireAccount } from '../../../../../utils/cabinet/account'
import { requireVenueMember } from '../../../../../utils/cabinet/flow'
import { limitUpload } from '../../../../../utils/cabinet/rate'

export default defineEventHandler(async (event) => {
  const user = await requireAccount(event)
  const venueId = getRouterParam(event, 'id') || ''
  const mediaId = getRouterParam(event, 'mediaId') || ''
  await requireVenueMember(user.id, venueId)
  limitUpload(user.id)
  const gallery = await db.venues.gallery(venueId)
  const item = gallery.find((row) => row.media.id === mediaId)
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Фото не найдено' })
  }
  if (item.origin !== 'venue') {
    throw createError({ statusCode: 403, statusMessage: 'Это фото редакции. Его можно убрать только в админке.' })
  }
  await deleteMediaCompletely(mediaId)
  await db.venueClaims.audit(venueId, user.id, 'photo_delete', { mediaId, origin: 'venue' })
  return { id: mediaId }
})
