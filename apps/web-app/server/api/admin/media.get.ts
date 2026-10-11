import { db } from '@k39/database'
import { requireEditor } from '../../utils/access'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const placeId = String(getQuery(event).placeId || '')
  if (!placeId) {
    return db.editor.listAllMedia()
  }
  return db.content.galleryFor(placeId)
})
