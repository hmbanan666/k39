import type { MediaLicense } from '@k39/database'
import { db } from '@k39/database'
import { ingestImage } from '../../../../media/ingest'
import { requireEditor } from '../../../../utils/access'

const LICENSES = new Set(['own', 'cc-by', 'cc-by-sa', 'cc0', 'pd', 'permission'])

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const venueId = getRouterParam(event, 'id') || ''
  const venue = await db.venues.byId(venueId)
  if (!venue) {
    throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
  }
  const parts = await readUploadForm(event)
  const file = parts?.find((part) => part.name === 'file' && part.data)
  const text = (name: string) => parts?.find((part) => part.name === name)?.data?.toString() || ''
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен файл' })
  }
  const licenseRaw = text('license')
  const license = LICENSES.has(licenseRaw) ? (licenseRaw as MediaLicense) : null
  const result = await ingestImage({
    bytes: file.data,
    mime: file.type || 'application/octet-stream',
    filename: file.filename || 'upload',
    alt: text('alt'),
    author: text('author') || null,
    license,
    sourceUrl: text('sourceUrl') || null,
    caption: text('caption') || null,
  })
  if ('error' in result) {
    throw createError({ statusCode: result.statusCode, statusMessage: result.error })
  }
  await db.venues.attachMedia(venueId, result.row.id, { isCover: text('isCover') === 'true' })
  return result.row
})
