import type { H3Event } from 'h3'
import { db } from '@k39/database'
import { createError } from 'h3'

export async function requireAccount(event: H3Event) {
  const session = await requireUserSession(event)
  const user = await db.user.find(session.user.id)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Войдите снова' })
  }
  return user
}
