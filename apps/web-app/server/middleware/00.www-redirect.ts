import { canonicalRedirect } from '../../shared/utils/canonical-redirect'

export default defineEventHandler((event) => {
  const host = getRequestHeader(event, 'x-forwarded-host') ?? getRequestHeader(event, 'host')
  const url = getRequestURL(event)
  const target = canonicalRedirect(host, `${url.pathname}${url.search}`)
  if (target) {
    return sendRedirect(event, target, 301)
  }
})
