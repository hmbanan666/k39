import { db } from '@k39/database'

export default defineEventHandler(async (event) => {
  if (!isDatabaseReady()) {
    setResponseStatus(event, 503)
    return { ok: false, status: 'starting' }
  }
  try {
    await db.checkHealth()
    return { ok: true }
  } catch (error) {
    throw errorResolver(error)
  }
})
