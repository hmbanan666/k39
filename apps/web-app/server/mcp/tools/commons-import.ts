import { db } from '@k39/database'
import { z } from 'zod'
import { downloadWikimedia } from '../../media/commons'
import { ingestImage } from '../../media/ingest'
import { auditMcp } from '../../utils/mcp/audit'
import { license } from '../../utils/mcp/schemas'

export default defineMcpTool({
  name: 'commons_import',
  description: 'Import one allowed Wikimedia Commons file into the photo pipeline and attach it to a place. The same pageUrl or fileUrl on that place returns the existing photo. The first photo on an empty place becomes the cover. A later import stays in the gallery unless isCover is true.',
  annotations: { openWorldHint: true },
  inputSchema: {
    placeId: z.string(),
    fileUrl: z.string(),
    pageUrl: z.string(),
    alt: z.string(),
    author: z.string(),
    license,
    isCover: z.boolean().optional(),
  },
  handler: async (input) => {
    const existing = await db.editor.mediaForPlaceSource(input.placeId, [input.pageUrl, input.fileUrl])
    if (existing) {
      return { id: existing.id, placeId: input.placeId, duplicate: true, warning: null }
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
      placeId: input.placeId,
      isCover: input.isCover,
    })
    if ('error' in saved) {
      throw createError({ statusCode: saved.statusCode, statusMessage: saved.error })
    }
    await auditMcp('commons_import', 'media', saved.row?.id)
    return { id: saved.row?.id, placeId: input.placeId, duplicate: false, warning: saved.warning || null }
  },
})
