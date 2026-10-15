import { db, VenueInputError } from '@k39/database'
import { requireEditor } from '../../../../utils/access'

export default defineEventHandler(async (event) => {
  const admin = await requireEditor(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await readBody(event)
  const revisionId = typeof body?.revisionId === 'string' ? body.revisionId : ''
  if (!revisionId) {
    throw createError({ statusCode: 400, statusMessage: 'Нужна правка' })
  }
  try {
    const saved = await db.venues.revertTo(id, revisionId, admin.id)
    if (!saved) {
      throw createError({ statusCode: 404, statusMessage: 'Правка не найдена' })
    }
    await db.venueClaims.audit(id, admin.id, 'revert', { revisionId })
    return { id: saved.id, slug: saved.slug }
  } catch (error) {
    if (error instanceof VenueInputError) {
      throw createError({ statusCode: 400, statusMessage: error.message })
    }
    throw error
  }
})
