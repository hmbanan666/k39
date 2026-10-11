import process from 'node:process'
import { db } from '@k39/database'

export async function requireEditor(event: Parameters<typeof getUserSession>[0]) {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const user = await db.user.find(session.user.id)
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return user
}

export function requireContentToken(event: Parameters<typeof getRequestHeader>[0]) {
  const token = process.env.CONTENT_API_TOKEN
  if (!token) {
    throw createError({ statusCode: 503, statusMessage: 'Content API is off' })
  }
  const header = getRequestHeader(event, 'authorization') ?? ''
  if (header !== `Bearer ${token}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}
