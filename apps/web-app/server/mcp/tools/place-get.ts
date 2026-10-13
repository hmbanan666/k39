import { db } from '@k39/database'
import { z } from 'zod'
import { toPublicMedia } from '../../../shared/media'

export default defineMcpTool({
  name: 'place_get',
  description: 'Load one place by id or slug, including media, sources, and related published places.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async ({ id, slug }) => {
    const place = id ? await db.editor.placeById(id) : slug ? await db.editor.placeBySlug(slug) : null
    if (!place) {
      throw createError({ statusCode: 404, statusMessage: 'Место не найдено' })
    }
    const gallery = await db.content.galleryFor(place.id)
    const related = await db.content.relatedFor(place.id)
    const category = place.categoryId
      ? (await db.content.categories()).find((item) => item.id === place.categoryId)
      : null
    const region = place.regionId
      ? (await db.editor.listRegions()).find((item) => item.id === place.regionId)
      : null
    return {
      id: place.id,
      slug: place.slug,
      title: place.title,
      summary: place.summary,
      body: place.body,
      status: place.status,
      publicationStatus: place.publicationStatus,
      hours: place.hours,
      price: place.price,
      howToGet: place.howToGet,
      latitude: place.latitude,
      longitude: place.longitude,
      categorySlug: category?.slug ?? null,
      regionSlug: region?.slug ?? null,
      sources: place.sources ?? [],
      seoTitle: place.seoTitle,
      seoDescription: place.seoDescription,
      ogImage: place.ogImage,
      noindex: place.noindex,
      factsCheckedAt: place.lastVerifiedAt,
      visitDuration: place.visitDuration,
      bestTime: place.bestTime,
      faq: place.faq ?? [],
      media: gallery.map((item) => ({
        ...compactMedia(item.media),
        isCover: item.isCover,
        sortOrder: item.sortOrder,
      })),
      related,
    }
  },
})

function compactMedia(row: Parameters<typeof toPublicMedia>[0]) {
  const media = toPublicMedia(row)
  return {
    id: media.id,
    alt: media.alt,
    width: media.width,
    height: media.height,
    focalX: media.focalX,
    focalY: media.focalY,
    author: media.author,
    license: media.license,
    sourceUrl: media.sourceUrl,
    src: media.src,
  }
}
