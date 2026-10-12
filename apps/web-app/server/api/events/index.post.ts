import { db, isDatabaseReady } from '@k39/database'
import { eventCreateSchema } from '@k39/types'
import { createId } from '@paralleldrive/cuid2'

export default defineEventHandler(async (event) => {
  try {
    const body = eventCreateSchema.parse(await readBody(event))
    if (!isDatabaseReady()) {
      throw createError({ statusCode: 503, statusMessage: 'Database is unavailable' })
    }

    const sessionId = createId()

    const place = body.placeSlug ? await db.editor.placeBySlug(body.placeSlug) : undefined
    const row = await db.eventLog.create({
      type: body.type,
      placeId: place?.id,
      placeSlug: body.placeSlug,
      routeSlug: body.routeSlug,
      questSlug: body.questSlug,
      sessionId,
      consent: true,
    })

    return { ok: true, id: row.id }
  } catch (error) {
    throw errorResolver(error)
  }
})
