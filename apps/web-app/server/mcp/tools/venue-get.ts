import { db } from '@k39/database'
import { z } from 'zod'
import { toPublicMedia } from '../../../shared/media'
import { venueIsStale } from '../../../shared/venues'

export default defineMcpTool({
  name: 'venue_get',
  description: 'Load one venue by id or slug, including hours, sources, and photos.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async ({ id, slug }) => {
    const venue = id ? await db.venues.byId(id) : slug ? await db.venues.bySlug(slug) : null
    if (!venue) {
      throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
    }
    const region = venue.regionId
      ? (await db.editor.listRegions()).find((item) => item.id === venue.regionId)
      : null
    const gallery = await db.venues.galleryFor(venue.id)
    return {
      ...venue,
      regionSlug: region?.slug ?? null,
      stale: venueIsStale(venue.lastVerifiedAt),
      path: `/zavedeniya/${venue.slug}`,
      media: gallery.map((item) => ({
        id: item.media.id,
        alt: item.media.alt,
        isCover: item.isCover,
        sortOrder: item.sortOrder,
        src: toPublicMedia(item.media).src,
      })),
    }
  },
})
