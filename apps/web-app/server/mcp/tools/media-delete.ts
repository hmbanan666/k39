import { z } from 'zod'
import { deleteMediaCompletely } from '../../media/ingest'
import { requireEditorContent } from '../../utils/access'
import { auditMcp } from '../../utils/mcp/audit'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'media_delete',
  description: 'Delete a stored photo and its files, the same way /admin does.',
  annotations: { destructiveHint: true },
  inputSchema: {
    id: z.string(),
  },
  handler: async ({ id }) => {
    requireEditorContent('delete media')
    const removed = await deleteMediaCompletely(id)
    if (!removed) {
      throw createError({ statusCode: 404, statusMessage: 'Фото не найдено' })
    }
    await auditMcp('media_delete', 'media', id)
    return { id, ok: true }
  },
})
