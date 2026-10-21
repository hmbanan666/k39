import type { MediaLicense } from '@k39/database'
import { db } from '@k39/database'
import { ingestImage } from '../../../../media/ingest'
import { uploadBodyProblem, uploadStatus } from '../../../../media/process'
import { requireAccount } from '../../../../utils/cabinet/account'
import { requireVenueMember } from '../../../../utils/cabinet/flow'
import { limitUpload } from '../../../../utils/cabinet/rate'

export default defineEventHandler(async (event) => {
  const user = await requireAccount(event)
  const venueId = getRouterParam(event, 'id') || ''
  await requireVenueMember(user.id, venueId)
  const tooLarge = uploadBodyProblem(getRequestHeader(event, 'content-length'))
  if (tooLarge) {
    throw createError({ statusCode: uploadStatus(tooLarge.code), statusMessage: tooLarge.message })
  }
  limitUpload(user.id)
  const venue = await db.venues.byId(venueId)
  if (!venue) {
    throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
  }
  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'file' && part.data)
  const text = (name: string) => parts?.find((part) => part.name === name)?.data?.toString() || ''
  if (text('rights') !== '1') {
    throw createError({ statusCode: 400, statusMessage: 'Подтвердите, что права на фото ваши и его можно опубликовать' })
  }
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен файл' })
  }
  const author = (text('author') || user.name).trim().slice(0, 120)
  if (!author) {
    throw createError({ statusCode: 400, statusMessage: 'Нужно имя автора' })
  }
  const result = await ingestImage({
    bytes: file.data,
    mime: file.type || 'application/octet-stream',
    filename: file.filename || 'upload',
    alt: text('alt'),
    author,
    license: 'permission' as MediaLicense,
    sourceUrl: null,
    caption: text('caption') || null,
  })
  if ('error' in result) {
    throw createError({ statusCode: result.statusCode, statusMessage: result.error })
  }
  const dish = text('placement') === 'dish'
  await db.venues.attachMedia(venueId, result.row.id, {
    origin: 'venue',
    isCover: dish ? false : text('isCover') === '1',
    promoteIfEmpty: dish ? false : undefined,
  })
  await db.venueClaims.audit(venueId, user.id, 'photo_upload', { mediaId: result.row.id, origin: 'venue' })
  return { id: result.row.id }
})
