import type { z } from 'zod'
import type { license } from './schemas'
import { db } from '@k39/database'
import { downloadWikimedia } from '../../media/commons'
import { ingestImage } from '../../media/ingest'
import { fetchPublicImage } from '../../media/public-url'
import { auditMcp } from './audit'
import { refuseIncomingPhoto } from './photos'
import { rejectBannedSites } from './writing-guard'

type MediaLicense = z.infer<typeof license>

/** commons_import. The draft-token refusal runs before the download. */
export async function importCommonsPhoto(input: {
  placeId?: string
  collectionId?: string
  caption?: string
  fileUrl: string
  pageUrl: string
  alt: string
  author: string
  license: MediaLicense
  isCover?: boolean
}) {
  if (input.license === 'permission') {
    throw createError({ statusCode: 400, statusMessage: 'Лицензия permission только для загрузки владельца в кабинете' })
  }
  if (Boolean(input.placeId) === Boolean(input.collectionId)) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен ровно один из placeId или collectionId' })
  }
  rejectBannedSites({ fileUrl: input.fileUrl, pageUrl: input.pageUrl, caption: input.caption })
  await refuseIncomingPhoto(input.placeId, input.collectionId)
  const urls = [input.pageUrl, input.fileUrl]
  const existing = input.placeId
    ? await db.editor.mediaForPlaceSource(input.placeId, urls)
    : await db.editor.mediaForCollectionSource(input.collectionId ?? '', urls)
  if (existing) {
    return { id: existing.id, placeId: input.placeId ?? null, collectionId: input.collectionId ?? null, duplicate: true, warning: null }
  }
  let file
  try {
    file = await downloadWikimedia(input.fileUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'fetch failed'
    throw createError({ statusCode: 502, statusMessage: message })
  }
  const saved = await ingestImage({
    bytes: file.bytes,
    mime: file.mime,
    filename: 'commons.jpg',
    alt: input.alt,
    author: input.author,
    license: input.license,
    sourceUrl: input.pageUrl,
    caption: input.caption,
    placeId: input.placeId,
    collectionId: input.collectionId,
    isCover: input.isCover,
  })
  if ('error' in saved) {
    throw createError({ statusCode: saved.statusCode, statusMessage: saved.error })
  }
  await auditMcp('commons_import', 'media', saved.row?.id)
  return { id: saved.row?.id, placeId: input.placeId ?? null, collectionId: input.collectionId ?? null, duplicate: false, warning: saved.warning || null }
}

/** media_upload_from_url. The draft-token refusal runs before the download. */
export async function uploadMediaFromUrl(input: {
  url: string
  alt: string
  author: string
  license: MediaLicense
  sourceUrl: string
  caption?: string
  placeId?: string
  collectionId?: string
  isCover?: boolean
}) {
  if (input.license === 'permission') {
    throw createError({ statusCode: 400, statusMessage: 'Лицензия permission только для загрузки владельца в кабинете' })
  }
  rejectBannedSites({ url: input.url, sourceUrl: input.sourceUrl })
  await refuseIncomingPhoto(input.placeId, input.collectionId)
  const file = await fetchPublicImage(input.url)
  const saved = await ingestImage({
    bytes: file.bytes,
    mime: file.mime,
    filename: file.filename,
    alt: input.alt,
    author: input.author,
    license: input.license,
    sourceUrl: input.sourceUrl,
    caption: input.caption,
    placeId: input.placeId,
    collectionId: input.placeId ? null : input.collectionId,
    isCover: input.isCover,
  })
  if ('error' in saved) {
    throw createError({ statusCode: saved.statusCode, statusMessage: saved.error })
  }
  await auditMcp('media_upload_from_url', 'media', saved.row?.id)
  return {
    id: saved.row?.id,
    width: saved.row?.width,
    height: saved.row?.height,
    warning: saved.warning || null,
  }
}
