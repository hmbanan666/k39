import { db } from '@k39/database'
import { requireEditor } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const venue = await db.venues.byId(getRouterParam(event, 'id') || '')
  if (!venue) {
    throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
  }
  const gallery = await db.venues.gallery(venue.id)
  return { venue, gallery }
})
