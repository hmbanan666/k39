import { db } from '@k39/database'
import { requireEditor } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const id = String(getRouterParam(event, 'id') || '')
  const venue = await db.venues.byId(id)
  if (!venue) {
    throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
  }
  const region = venue.regionId
    ? (await db.editor.listRegions()).find((item) => item.id === venue.regionId)
    : null
  const gallery = await db.venues.galleryFor(venue.id)
  return {
    ...venue,
    regionSlug: region?.slug ?? '',
    media: gallery.map((item) => ({
      id: item.media.id,
      alt: item.media.alt,
      isCover: item.isCover,
    })),
  }
})
