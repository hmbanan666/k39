import { db } from '@k39/database'
import { removeStoredMedia } from '../../../media/ingest'
import { requireEditor } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const id = String(getRouterParam(event, 'id') || '')
  const current = await db.editor.mediaById(id)
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Фото не найдено' })
  }
  await removeStoredMedia(id)
  if (current.filename && !current.filename.includes('/')) {
    const storage = await import('../../../media/storage')
    await storage.createLocalMediaStorage().delete(current.filename)
  }
  await db.editor.deleteMedia(id)
  return { ok: true }
})
