import type { MediaLicense } from '@k39/database'
import { downloadWikimedia } from '../../../media/commons'
import { ingestImage } from '../../../media/ingest'
import { requireEditor } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readBody<{
    fileUrl?: string
    pageUrl?: string
    alt?: string
    author?: string
    license?: MediaLicense
    placeId?: string
  }>(event)
  if (!body.fileUrl || !body.alt?.trim() || !body.placeId) {
    throw createError({ statusCode: 400, statusMessage: 'Нужны файл, alt и место' })
  }
  try {
    const downloaded = await downloadWikimedia(body.fileUrl)
    const result = await ingestImage({
      bytes: downloaded.bytes,
      mime: downloaded.mime,
      filename: 'commons.jpg',
      alt: body.alt,
      author: body.author || null,
      license: body.license || null,
      sourceUrl: body.pageUrl || body.fileUrl,
      placeId: body.placeId,
    })
    if ('error' in result) {
      throw createError({ statusCode: result.statusCode, statusMessage: result.error })
    }
    return { ...result.row, warning: result.warning }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({ statusCode: 502, statusMessage: 'Викисклад не отдал файл' })
  }
})
