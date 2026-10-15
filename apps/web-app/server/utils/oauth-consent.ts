import type { H3Event } from 'h3'
import { db } from '@k39/database'
import { safeInternalPath } from '../../shared/cabinet'
import { CONSENT_COOKIE, CONSENT_METHOD, CONSENT_VERSION, consentDeniedLocation, consentParamAccepted, isOAuthCallback, oauthCallbackAllowed, oauthStartAllowed } from '../../shared/consent'

const cookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: 60 * 10,
}

function rememberOAuthConsent(event: H3Event) {
  setCookie(event, CONSENT_COOKIE, CONSENT_VERSION, cookieOptions)
}

function deny(event: H3Event, redirectTo: unknown) {
  deleteCookie(event, CONSENT_COOKIE, { path: '/' })
  return sendRedirect(event, consentDeniedLocation(redirectTo))
}

export function guardOAuthStart(event: H3Event) {
  const query = getQuery(event)
  if (!consentParamAccepted(query.consent, query.version)) {
    return deny(event, query.redirectTo)
  }
  rememberOAuthConsent(event)
  return null
}

export function guardOAuthProvider(event: H3Event) {
  const query = getQuery(event)
  const cookie = getCookie(event, CONSENT_COOKIE)
  if (!isOAuthCallback(query)) {
    if (!oauthStartAllowed({ consent: query.consent, version: query.version, cookie })) {
      return deny(event, query.redirectTo ?? getCookie(event, 'redirectTo'))
    }
    if (consentParamAccepted(query.consent, query.version)) {
      rememberOAuthConsent(event)
    }
    return null
  }
  if (!oauthCallbackAllowed(cookie)) {
    return deny(event, getCookie(event, 'redirectTo'))
  }
  return null
}

export async function completeConsentedSession(event: H3Event, user: { id: string, email: string, role: 'user' | 'editor' | 'admin' }) {
  if (!oauthCallbackAllowed(getCookie(event, CONSENT_COOKIE))) {
    return deny(event, getCookie(event, 'redirectTo'))
  }
  await db.consent.record({
    userId: user.id,
    version: CONSENT_VERSION,
    method: CONSENT_METHOD,
  })
  deleteCookie(event, CONSENT_COOKIE, { path: '/' })
  await setUserSession(event, {
    user: { id: user.id, email: user.email, role: user.role },
  })
  return sendRedirect(event, safeInternalPath(getCookie(event, 'redirectTo')))
}
