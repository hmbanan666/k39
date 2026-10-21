import { db, VENUE_PHOTO_ORIGINS } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'
import { refuseVenuePhoto } from '../../utils/mcp/photos'

export default defineMcpTool({
  name: 'media_attach_to_venue',
  description: 'Attach a stored photo to a venue. origin is own (our photo) or commons. origin venue is the cabinet owner upload only. The photo must already carry an author. Never attach a copy from another site. A draft token cannot attach a photo to a published or closed venue. That answer is 409 and the live page stays.',
  inputSchema: {
    venueId: z.string(),
    mediaId: z.string(),
    origin: z.enum(VENUE_PHOTO_ORIGINS),
    isCover: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  },
  handler: async (input) => {
    const venue = await refuseVenuePhoto(input.venueId)
    const media = await db.editor.mediaById(input.mediaId)
    if (!media) {
      throw createError({ statusCode: 404, statusMessage: 'Фото не найдено' })
    }
    if (input.origin === 'venue') {
      throw createError({ statusCode: 400, statusMessage: 'Происхождение venue только для фото владельца из кабинета' })
    }
    if (!(media.author || media.credit)) {
      throw createError({ statusCode: 400, statusMessage: 'У фото нет автора. Укажите автора и лицензию перед привязкой' })
    }
    await db.venues.attachMedia(venue.id, media.id, { isCover: input.isCover, origin: input.origin, sortOrder: input.sortOrder })
    await auditMcp('media_attach_to_venue', 'venue', venue.id)
    return { venueId: venue.id, mediaId: media.id, origin: input.origin, isCover: Boolean(input.isCover) }
  },
})
