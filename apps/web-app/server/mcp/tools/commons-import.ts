import { db } from '@k39/database'
import { z } from 'zod'
import { downloadWikimedia } from '../../media/commons'
import { ingestImage } from '../../media/ingest'
import { auditMcp } from '../../utils/mcp/audit'
import { license } from '../../utils/mcp/schemas'

export default defineMcpTool({
  name: 'commons_import',
  description: 'Import one allowed Wikimedia Commons file into the photo pipeline and attach it to a place or a collection (pass exactly one of placeId or collectionId). The same pageUrl or fileUrl on that target returns the existing photo. The first photo on an empty target becomes the cover. A later import stays in the gallery unless isCover is true. caption is shown under the photo on collection pages.',
  annotations: { openWorldHint: true },
  inputSchema: {
    placeId: z.string().optional(),
    collectionId: z.string().optional(),
    caption: z.string().optional(),
    fileUrl: z.string(),
    pageUrl: z.string(),
    alt: z.string(),
    author: z.string(),
    license,
    isCover: z.boolean().optional(),
  },
  handler: async (input) => {
    if (input.license === 'permission') {
      throw createError({ statusCode: 400, statusMessage: 'Лицензия permission только для загрузки владельца в кабинете' })
    }
    if (Boolean(input.placeId) === Boolean(input.collectionId)) {
      throw createError({ statusCode: 400, statusMessage: 'Нужен ровно один из placeId или collectionId' })
    }
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
  },
})
