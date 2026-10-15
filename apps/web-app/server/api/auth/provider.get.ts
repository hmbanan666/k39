import { safeInternalPath } from '../../../shared/cabinet'
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

  const redirectTo = safeInternalPath(query.redirectTo, '')
  if (redirectTo) {
    setCookie(event, 'redirectTo', redirectTo, { path: '/', httpOnly: true, sameSite: 'lax' })
  }

  return sendRedirect(event, `/api/auth/${provider}`)
})
