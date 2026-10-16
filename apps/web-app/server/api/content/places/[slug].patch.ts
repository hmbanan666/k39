import { db } from '@k39/database'
import { requireContentToken } from '../../../utils/access'
import { placeWriteFromBody, updatePlaceDraft } from '../../../utils/mcp/places'

export default defineEventHandler(async (event) => {
  requireContentToken(event)
  const slug = String(getRouterParam(event, 'slug'))
  const current = await db.editor.placeBySlug(slug)
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Место не найдено' })
  }
  const body = await readBody(event)
  return updatePlaceDraft(placeWriteFromBody(body ?? {}, current))
})
