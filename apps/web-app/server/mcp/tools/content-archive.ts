import { db } from '@k39/database'
import { createError } from 'h3'
import { z } from 'zod'
import { requireEditorContent } from '../../utils/access'
import { auditMcp } from '../../utils/mcp/audit'
import { rethrowContentWrite } from '../../utils/mcp/content-error'

export default defineMcpTool({
  name: 'content_archive',
  description: 'Delete a draft route or collection. A published or review row is archived instead: the row stays, it leaves the public site, and its URL returns 410. Writes an mcp_audits row. A draft that a quest or offer still links cannot be deleted.',
  annotations: { destructiveHint: true },
  inputSchema: {
    entity: z.enum(['route', 'collection']),
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async (input) => {
    requireEditorContent('archive content')
    if (!input.id && !input.slug) {
      throw createError({ statusCode: 400, statusMessage: 'Нужен id или slug' })
    }
    const rows = input.entity === 'route'
      ? await db.editor.listRoutes()
      : await db.editor.listCollections()
    const current = input.id
      ? rows.find((item) => item.id === input.id)
      : rows.find((item) => item.slug === input.slug)
    if (!current) {
      throw createError({
        statusCode: 404,
        statusMessage: input.entity === 'route' ? 'Маршрут не найден' : 'Подборка не найдена',
      })
    }
    try {
      const result = input.entity === 'route'
        ? await db.editor.archiveOrDeleteRoute(current.id)
        : await db.editor.archiveOrDeleteCollection(current.id)
      if (!result) {
        throw createError({
          statusCode: 404,
          statusMessage: input.entity === 'route' ? 'Маршрут не найден' : 'Подборка не найдена',
        })
      }
      await auditMcp('content_archive', input.entity, result.id)
      return { entity: input.entity, ...result }
    } catch (error) {
      rethrowContentWrite(error)
    }
  },
})
