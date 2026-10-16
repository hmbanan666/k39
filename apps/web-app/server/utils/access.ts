import { AsyncLocalStorage } from 'node:async_hooks'
import { Buffer } from 'node:buffer'
import { createHash, timingSafeEqual } from 'node:crypto'
import process from 'node:process'
import { db } from '@k39/database'
import { getRequestHeader, setResponseHeader } from 'h3'
import { useEvent } from 'nitropack/runtime/internal/context'
import { adminRedirect } from '../../shared/auth'

export type ContentScope = 'editor' | 'draft'

const contentScopeStore = new AsyncLocalStorage<ContentScope>()

/** Cursor falls back to the configured Authorization header when this challenge has no resource_metadata. */
export const CONTENT_BEARER_CHALLENGE = 'Bearer realm="k39"'

export async function requireEditor(event: Parameters<typeof requireUserSession>[0]) {
  const session = await requireUserSession(event)
  const user = await db.user.find(session.user.id)
  if (!user || adminRedirect(user) !== null) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return user
}

function bearerSecret(authorization: string | undefined) {
  if (!authorization?.startsWith('Bearer ')) {
    return ''
  }
  return authorization.slice('Bearer '.length)
}

function secretMatches(presented: string, expected: string | undefined) {
  if (!expected || !presented) {
    return false
  }
  const left = Buffer.from(presented)
  const right = Buffer.from(expected)
  if (left.length !== right.length) {
    return false
  }
  return timingSafeEqual(left, right)
}

export interface ContentAuthOk {
  ok: true
  scope: ContentScope
}

export interface ContentAuthFailure {
  ok: false
  statusCode: number
  statusMessage: string
}

/**
 * Editor token (`CONTENT_API_TOKEN`) can publish and edit live pages.
 * Draft token (`CONTENT_DRAFT_TOKEN`) can read and write drafts or a pending review.
 * The editor secret wins when both variables hold the same value.
 */
export function resolveContentAuth(authorization: string | undefined): ContentAuthOk | ContentAuthFailure {
  const editor = process.env.CONTENT_API_TOKEN
  const draft = process.env.CONTENT_DRAFT_TOKEN
  if (!editor && !draft) {
    return { ok: false, statusCode: 503, statusMessage: 'Content API is off' }
  }
  const presented = bearerSecret(authorization)
  if (secretMatches(presented, editor)) {
    return { ok: true, scope: 'editor' }
  }
  if (secretMatches(presented, draft)) {
    return { ok: true, scope: 'draft' }
  }
  return { ok: false, statusCode: 401, statusMessage: 'Unauthorized' }
}

export function contentAuthFailure(authorization: string | undefined) {
  const result = resolveContentAuth(authorization)
  if (result.ok) {
    return null
  }
  return { statusCode: result.statusCode, statusMessage: result.statusMessage }
}

export function contentScope(): ContentScope {
  try {
    const marked = useEvent().context.contentScope
    if (marked === 'draft' || marked === 'editor') {
      return marked
    }
  } catch {
    // No request. In-process calls (the admin form, tests) stay on the editor path.
  }
  return contentScopeStore.getStore() ?? 'editor'
}

export function enterContentScope(scope: ContentScope) {
  contentScopeStore.enterWith(scope)
}

export function contentRateKey(authorization: string | undefined) {
  const secret = bearerSecret(authorization)
  return createHash('sha256').update(secret).digest('hex')
}

export function requireContentToken(event: Parameters<typeof getRequestHeader>[0]) {
  const authorization = getRequestHeader(event, 'authorization') ?? ''
  const result = resolveContentAuth(authorization)
  if (!result.ok) {
    if (result.statusCode === 401) {
      setResponseHeader(event, 'WWW-Authenticate', CONTENT_BEARER_CHALLENGE)
    }
    throw createError({ statusCode: result.statusCode, statusMessage: result.statusMessage })
  }
  enterContentScope(result.scope)
  event.context.contentScope = result.scope
  return result.scope
}

export function requireEditorContent(action: string) {
  if (contentScope() === 'draft') {
    throw createError({ statusCode: 403, statusMessage: `Draft token cannot ${action}` })
  }
}
