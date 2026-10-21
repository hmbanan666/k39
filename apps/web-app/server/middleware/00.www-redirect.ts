import { db, isDatabaseReady } from '@k39/database'
import { decideRedirect, REDIRECT_HOP_LIMIT, rewritePath } from '../../shared/redirects'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_nuxt') || url.pathname.startsWith('/media/') || url.pathname.includes('.')) {
    return
  }
  const stored = isDatabaseReady()
    ? await db.content.redirectChain(rewritePath(url.pathname), REDIRECT_HOP_LIMIT)
    : []
  const decision = decideRedirect({
    hostHeader: getRequestHeader(event, 'x-forwarded-host') ?? getRequestHeader(event, 'host'),
    protoHeader: getRequestHeader(event, 'x-forwarded-proto'),
    path: url.pathname,
    search: url.search,
    redirects: stored,
  })
  if (decision.kind === 'gone') {
    throw createError({ statusCode: 410, statusMessage: 'Gone' })
  }
  if (decision.kind === 'redirect') {
    return sendRedirect(event, decision.location, 301)
  }
})
