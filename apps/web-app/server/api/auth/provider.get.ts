import { assertOAuthProvider } from '../../utils/oauth'
import { guardOAuthStart } from '../../utils/oauth-consent'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const provider = String(query.provider ?? '')
  assertOAuthProvider(provider)

  const denied = guardOAuthStart(event)
  if (denied) {
    return denied
  }

  if (query.redirectTo) {
    setCookie(event, 'redirectTo', query.redirectTo.toString(), { path: '/', httpOnly: true, sameSite: 'lax' })
  }

  return sendRedirect(event, `/api/auth/${provider}`)
})
