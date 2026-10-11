import type { MediaLicense } from '@k39/database'
import { ingestImage } from '../../media/ingest'
import { requireEditor } from '../../utils/access'

const LICENSES = new Set(['own', 'cc-by', 'cc-by-sa', 'cc0', 'pd', 'permission'])

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'file' && part.data)
  const text = (name: string) => parts?.find((part) => part.name === name)?.data?.toString() || ''
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен файл' })
  }
  const licenseRaw = text('license')
  const license = LICENSES.has(licenseRaw) ? licenseRaw as MediaLicense : null
  try {
    const result = await ingestImage({
      bytes: file.data,
      mime: file.type || 'application/octet-stream',
      filename: file.filename || 'upload',
      alt: text('alt'),
      author: text('author') || text('credit') || null,
      license,
      sourceUrl: text('sourceUrl') || null,
      caption: text('caption') || null,
      placeId: text('placeId') || null,
      isCover: text('isCover') === 'true',
    })
    if ('error' in result) {
      throw createError({ statusCode: result.statusCode, statusMessage: result.error })
    }
    return { ...result.row, warning: result.warning }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({ statusCode: 500, statusMessage: 'Не удалось обработать фото' })
  }
})
