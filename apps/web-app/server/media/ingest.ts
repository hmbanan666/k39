import type { MediaLicense } from '@k39/database'
import type { Buffer } from 'node:buffer'
import { db } from '@k39/database'
import { createId } from '@paralleldrive/cuid2'
import { bannedSiteProblem } from '../../shared/writing'
import { processImage, uploadProblem, uploadStatus } from './process'
import { withMediaSlot } from './semaphore'
import { createLocalMediaStorage } from './storage'

const VARIANT_FILES = [
  'master.webp',
  'og.jpg',
  '320.avif',
  '320.webp',
  '640.avif',
  '640.webp',
  '960.avif',
  '960.webp',
  '1280.avif',
  '1280.webp',
  '1920.avif',
  '1920.webp',
]

export function coverSizeWarning(sourceWidth: number, isCover: boolean) {
  if (!isCover || sourceWidth >= 1200) {
    return ''
  }
  return 'Исходник уже 1200 пикселей. Для крупной обложки лучше фото шире.'
}

export async function removeStoredMedia(mediaId: string) {
  const storage = createLocalMediaStorage()
  await Promise.all(VARIANT_FILES.map((file) => storage.delete(`${mediaId}/${file}`)))
}

export async function deleteMediaCompletely(id: string) {
  const current = await db.editor.mediaById(id)
  if (!current) {
    return null
  }
  await removeStoredMedia(id)
  if (current.filename && !current.filename.includes('/')) {
    await createLocalMediaStorage().delete(current.filename)
  }
  await db.editor.deleteMedia(id)
  return current
}

export async function ingestImage(input: {
  bytes: Buffer
  mime: string
  filename: string
  alt: string
  author?: string | null
  license?: MediaLicense | null
  sourceUrl?: string | null
  caption?: string | null
  placeId?: string | null
  collectionId?: string | null
  isCover?: boolean
}) {
  const banned = bannedSiteProblem(input.sourceUrl)
  if (banned) {
    return { error: banned, statusCode: 400 }
  }
  // Client MIME is not a format. uploadProblem reads the header.
  const problem = await uploadProblem(input.bytes, input.filename)
  if (problem) {
    return { error: problem.message, statusCode: uploadStatus(problem.code) }
  }
  if (!input.alt.trim()) {
    return { error: 'Нужен alt.', statusCode: 400 }
  }
  const id = createId()
  const storage = createLocalMediaStorage()
  let processed
  try {
    processed = await withMediaSlot(() => processImage(input.bytes, id, storage))
  } catch (error) {
    await removeStoredMedia(id)
    throw error
  }
  try {
    const row = await db.editor.saveMedia({
      id,
      filename: processed.filename,
      mime: processed.mime,
      bytes: processed.bytes,
      width: processed.width,
      height: processed.height,
      alt: input.alt.trim(),
      author: input.author ?? null,
      license: input.license ?? null,
      sourceUrl: input.sourceUrl ?? null,
      caption: input.caption ?? null,
      placeId: input.placeId ?? null,
      status: 'ready',
      variants: processed.variants,
      lqip: processed.lqip,
      dominantColor: processed.dominantColor,
    })
    if (!row) {
      throw new Error('Media insert failed')
    }
    let isCover = input.isCover
    if (input.placeId) {
      const attached = await db.editor.attachMedia(input.placeId, row.id, { isCover: input.isCover })
      isCover = attached?.isCover ?? false
    } else if (input.collectionId) {
      const attached = await db.editor.attachCollectionMedia(input.collectionId, row.id, { isCover: input.isCover })
      isCover = attached?.isCover ?? false
    }
    return {
      row,
      warning: coverSizeWarning(processed.sourceWidth, Boolean(isCover)),
    }
  } catch (error) {
    await removeStoredMedia(id)
    throw error
  }
}
