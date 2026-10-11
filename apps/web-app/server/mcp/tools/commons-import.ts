import { z } from 'zod'
import { downloadWikimedia } from '../../media/commons'
import { ingestImage } from '../../media/ingest'
import { auditMcp } from '../../utils/mcp/audit'
import { license } from '../../utils/mcp/schemas'

export default defineMcpTool({
  name: 'commons_import',
  description: 'Import one allowed Wikimedia Commons file into the photo pipeline and attach it to a place.',
  annotations: { openWorldHint: true },
  inputSchema: {
    placeId: z.string(),
    fileUrl: z.string(),
    pageUrl: z.string(),
    alt: z.string(),
    author: z.string(),
    license,
  },
  handler: async (input) => {
    const file = await downloadWikimedia(input.fileUrl)
    const saved = await ingestImage({
      bytes: file.bytes,
      mime: file.mime,
      filename: 'commons.jpg',
      alt: input.alt,
      author: input.author,
      license: input.license,
      sourceUrl: input.pageUrl,
      placeId: input.placeId,
    })
    if ('error' in saved) {
      throw createError({ statusCode: saved.statusCode, statusMessage: saved.error })
    }
    await auditMcp('commons_import', 'media', saved.row?.id)
    return { id: saved.row?.id, placeId: input.placeId, warning: saved.warning || null }
  },
})
