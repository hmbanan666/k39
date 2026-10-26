import { db } from '@k39/database'
import { refuseDraftLivePage } from './draft'

/**
 * A draft token must not change the cover, gallery, or caption of a live
 * place or collection. Missing rows are left to the writer.
 */
export async function refuseVenuePhoto(venueId: string) {
  const venue = await db.venues.byId(venueId)
  if (!venue) {
    throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
  }
  refuseDraftLivePage('attach a photo to a published venue', venue.status, ['published', 'closed', 'archived'])
  return venue
}

export async function refuseIncomingPhoto(placeId?: string | null, collectionId?: string | null) {
  if (placeId) {
    const place = await db.editor.placeById(placeId)
    refuseDraftLivePage('add a photo to a published place', place?.publicationStatus)
    return
  }
  if (collectionId) {
    const collection = await db.editor.collectionById(collectionId)
    refuseDraftLivePage('add a photo to a published collection', collection?.publicationStatus)
  }
}

export async function attachPlacePhoto(input: {
  placeId: string
  mediaId: string
  isCover?: boolean
  sortOrder?: number
  focalX?: number
  focalY?: number
}) {
  const media = await db.editor.mediaById(input.mediaId)
  if (!media) {
    throw createError({ statusCode: 404, statusMessage: 'Фото не найдено' })
  }
  const place = await db.editor.placeById(input.placeId)
  refuseDraftLivePage('attach a photo to a published place', place?.publicationStatus)
  await db.editor.attachMedia(input.placeId, input.mediaId, {
    isCover: input.isCover,
    sortOrder: input.sortOrder,
  })
  if (input.isCover) {
    await db.editor.setCover(input.placeId, input.mediaId)
  }
  if (input.focalX !== undefined || input.focalY !== undefined) {
    await db.editor.updateMedia(input.mediaId, {
      focalX: input.focalX,
      focalY: input.focalY,
    })
  }
  return { placeId: input.placeId, mediaId: input.mediaId, isCover: Boolean(input.isCover) }
}

export async function attachCollectionPhoto(input: {
  collectionId: string
  mediaId: string
  isCover?: boolean
  sortOrder?: number
  caption?: string | null
  focalX?: number
  focalY?: number
}) {
  const media = await db.editor.mediaById(input.mediaId)
  if (!media) {
    throw createError({ statusCode: 404, statusMessage: 'Фото не найдено' })
  }
  const collection = await db.editor.collectionById(input.collectionId)
  refuseDraftLivePage('attach a photo to a published collection', collection?.publicationStatus)
  const row = await db.editor.attachCollectionMedia(input.collectionId, input.mediaId, {
    isCover: input.isCover,
    sortOrder: input.sortOrder,
  })
  if (input.caption !== undefined || input.focalX !== undefined || input.focalY !== undefined) {
    await db.editor.updateMedia(input.mediaId, {
      caption: input.caption,
      focalX: input.focalX,
      focalY: input.focalY,
    })
  }
  return {
    collectionId: input.collectionId,
    mediaId: input.mediaId,
    isCover: Boolean(row?.isCover),
    sortOrder: row?.sortOrder,
  }
}

export async function detachCollectionPhoto(input: { collectionId: string; mediaId: string }) {
  const collection = await db.editor.collectionById(input.collectionId)
  refuseDraftLivePage('remove a photo from a published collection', collection?.publicationStatus)
  const removed = await db.editor.detachCollectionMedia(input.collectionId, input.mediaId)
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: 'Фото не привязано к подборке' })
  }
  return { collectionId: input.collectionId, mediaId: input.mediaId, removed: true as const }
}
