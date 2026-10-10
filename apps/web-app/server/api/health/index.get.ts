import { db } from '@k39/database'

export default defineEventHandler(async () => {
  try {
    await db.checkHealth()
    return { ok: true }
  } catch (error) {
    throw errorResolver(error)
  }
})
