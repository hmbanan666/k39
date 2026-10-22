import { z } from 'zod'
import { adminPracticalTarget } from '../../../../../utils/practical/admin'
import { eventInput, upsertEvent } from '../../../../../utils/practical/events'

const bodySchema = z.object({
  id: z.string().optional(),
  remove: z.boolean().optional(),
  event: eventInput.optional(),
})

export default defineEventHandler(async (event) => {
  const target = await adminPracticalTarget(event)
  const parsed = bodySchema.safeParse(await readJsonBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Проверьте поля события' })
  }
  return upsertEvent(target, parsed.data, 'editor')
})
