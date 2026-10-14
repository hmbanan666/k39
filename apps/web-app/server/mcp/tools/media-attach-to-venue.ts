import { db, VENUE_PHOTO_ORIGINS } from '@k39/database'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'media_attach_to_venue',
  description: 'Attach a stored photo to a venue. origin says who supplied it: own (our photo), venue (sent by the venue with permission), commons (free license). The photo must already carry an author. Never attach a copy from another site.',
  inputSchema: {
    venueId: z.string(),
    mediaId: z.string(),
    origin: z.enum(VENUE_PHOTO_ORIGINS),
    isCover: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  },
  handler: async (input) => {
    const venue = await db.venues.byId(input.venueId)
    if (!venue) {
      throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
    }
    const media = await db.editor.mediaById(input.mediaId)
    if (!media) {
      throw createError({ statusCode: 404, statusMessage: 'Фото не найдено' })
    }
    if (!(media.author || media.credit)) {
      throw createError({ statusCode: 400, statusMessage: 'У фото нет автора. Укажите автора и лицензию перед привязкой' })
    }
    await db.venues.attachMedia(venue.id, media.id, { isCover: input.isCover, origin: input.origin, sortOrder: input.sortOrder })
    await auditMcp('media_attach_to_venue', 'venue', venue.id)
    return { venueId: venue.id, mediaId: media.id, origin: input.origin, isCover: Boolean(input.isCover) }
  },
})
