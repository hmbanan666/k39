import process from 'node:process'
import { db } from '@k39/database'
import { adminRedirect } from '../../shared/auth'

export async function requireEditor(event: Parameters<typeof requireUserSession>[0]) {
  const session = await requireUserSession(event)
  const user = await db.user.find(session.user.id)
  if (!user || adminRedirect(user) !== null) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return user
}

export function contentAuthFailure(authorization: string | undefined) {
  const token = process.env.CONTENT_API_TOKEN
  if (!token) {
    return { statusCode: 503, statusMessage: 'Content API is off' }
  }
  if (authorization !== `Bearer ${token}`) {
    return { statusCode: 401, statusMessage: 'Unauthorized' }
  }
  return null
}

export function requireContentToken(event: Parameters<typeof getRequestHeader>[0]) {
  const failure = contentAuthFailure(getRequestHeader(event, 'authorization') ?? '')
  if (failure) {
    throw createError(failure)
  }
}
