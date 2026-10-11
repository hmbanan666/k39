import { deleteMediaCompletely } from '../../../media/ingest'
import { requireEditor } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const id = String(getRouterParam(event, 'id') || '')
  const removed = await deleteMediaCompletely(id)
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: 'Фото не найдено' })
  }
  return { ok: true }
})
