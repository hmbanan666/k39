import { z } from 'zod'
import { ingestImage } from '../../media/ingest'
import { fetchPublicImage } from '../../media/public-url'
import { auditMcp } from '../../utils/mcp/audit'
import { license } from '../../utils/mcp/schemas'

export default defineMcpTool({
  name: 'media_upload_from_url',
  description: 'Download an https image from a public host, run the photo pipeline, and store it. Alt, author, license, and sourceUrl are required. License is own or a Commons license. permission is the cabinet owner upload only.',
  inputSchema: {
    url: z.string().describe('https URL of a JPEG, PNG, or WebP'),
    alt: z.string(),
    author: z.string(),
    license,
    sourceUrl: z.string(),
    caption: z.string().optional(),
    placeId: z.string().optional(),
    collectionId: z.string().optional().describe('Attach to a collection instead of a place'),
    isCover: z.boolean().optional(),
  },
  handler: async (input) => {
    if (input.license === 'permission') {
      throw createError({ statusCode: 400, statusMessage: 'Лицензия permission только для загрузки владельца в кабинете' })
    }
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
  },
})
