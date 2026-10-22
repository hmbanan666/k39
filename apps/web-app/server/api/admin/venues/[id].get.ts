import { db } from '@k39/database'
import { requireEditor } from '../../../utils/access'
import { venueDraftNotice } from '../../../utils/admin/venue-draft'
import { readShownFacts, shownText } from '../../../utils/facts/read'
import { loadHoursForm } from '../../../utils/schedule'

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
  // Hours come from the schedule only; the legacy `venues.hours` column is not sent.
  const { hours: _legacyHours, ...row } = venue
  return {
    venue: { ...row, phone: shownText(shown?.phone, venue.phone) },
    hours: await loadHoursForm('venue', venue.id),
    gallery,
    pending: await venueDraftNotice(venue.id),
  }
})
