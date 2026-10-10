import { assertOAuthProvider } from '../../utils/oauth'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const provider = String(query.provider ?? '')
  assertOAuthProvider(provider)

  if (query.redirectTo) {
    setCookie(event, 'redirectTo', query.redirectTo.toString(), { path: '/', httpOnly: true, sameSite: 'lax' })
  }

  return sendRedirect(event, `/api/auth/${provider}`)
})
