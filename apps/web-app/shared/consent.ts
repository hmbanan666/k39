export const CONSENT_VERSION = '2026-10-12'
export const CONSENT_DATE = '12 октября 2026 года'
export const CONSENT_METHOD = 'sign-in-checkbox'
export const CONSENT_COOKIE = 'k39_oauth_consent'
export const CONSENT_PATH = '/soglasie'

export function consentParamAccepted(consent: unknown, version: unknown) {
  return consent === '1' && version === CONSENT_VERSION
}

export function oauthStartAllowed(input: { consent: unknown, version: unknown, cookie: string | undefined }) {
  return consentParamAccepted(input.consent, input.version) || input.cookie === CONSENT_VERSION
}

export function oauthCallbackAllowed(cookie: string | undefined) {
  return cookie === CONSENT_VERSION
}

export function isOAuthCallback(query: object) {
  return 'code' in query || 'error' in query || 'payload' in query
}

export function consentDeniedLocation(redirectTo: unknown) {
  const params = new URLSearchParams({ error: 'consent' })
  if (typeof redirectTo === 'string' && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
    params.set('redirectTo', redirectTo)
  }
  return `/sign-in?${params.toString()}`
}
