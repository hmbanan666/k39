import { db, VenueInputError } from '@k39/database'
import { createError } from 'h3'
import { z } from 'zod'
import { auditMcp } from '../../utils/mcp/audit'
import { venueError } from '../../utils/venues/write'

export default defineMcpTool({
  name: 'venue_delete',
  description: 'Delete a draft or archived venue. A published or closed venue is left in place. Writes an mcp_audits row.',
  annotations: { destructiveHint: true },
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
  },
  handler: async ({ id, slug }) => {
    if (!id && !slug) {
      throw createError({ statusCode: 400, statusMessage: 'Нужен id или slug' })
    }
    const current = id ? await db.venues.byId(id) : await db.venues.bySlug(slug || '')
    if (!current) {
      throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
    }
    try {
      const result = await db.venues.remove(current.id)
      if (!result) {
        throw createError({ statusCode: 404, statusMessage: 'Заведение не найдено' })
      }
      await auditMcp('venue_delete', 'venue', result.id)
      return result
    } catch (error) {
      if (error instanceof VenueInputError && error.message.startsWith('Удалить можно только')) {
        throw createError({ statusCode: 409, statusMessage: error.message })
      }
      venueError(error)
    }
  },
})
