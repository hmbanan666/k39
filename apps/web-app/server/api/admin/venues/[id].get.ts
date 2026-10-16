import { db } from '@k39/database'
import { requireEditor } from '../../../utils/access'
import { readShownFacts, shownText } from '../../../utils/facts/read'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const venue = await db.venues.byId(getRouterParam(event, 'id') || '')
  if (!venue) {
    throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
  }
  const gallery = await db.venues.gallery(venue.id)
  const shown = (await readShownFacts('venue', [{
    id: venue.id,
    phone: venue.phone,
    address: venue.address,
    status: venue.status,
  }])).get(venue.id)
  return { venue: { ...venue, phone: shownText(shown?.phone, venue.phone) }, gallery }
})
