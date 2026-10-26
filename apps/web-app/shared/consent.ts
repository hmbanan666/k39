export const CONSENT_VERSION = '2026-10-12'
export const CONSENT_DATE = '12 октября 2026 года'

/** Guest-content consent. Distinct from the sign-in version so the active key does not collide. */
export const GUEST_CONSENT_VERSION = 'ugc-2026-10-16'
export const GUEST_CONSENT_DATE = '16 октября 2026 года'
export const GUEST_CONSENT_METHOD = 'ugc-submit'
export const GUEST_CONSENT_PATH = '/gostevye-materialy'

/**
 * Legal map. The sign-in button is the consent. There is no checkbox.
 *
 * - `/sign-in` explains that pressing the provider button gives consent and
 *   links to `/soglasie`. The start request carries `consent=1` and this version.
 * - `CONSENT_METHOD` is what `user_consents.method` stores: `sign-in-button`.
 * - `/soglasie` is the consent document (name, email, profile image, provider id).
 * - `/privacy` links to that document. `/terms` does not. The footer does not.
 * - `CONSENT_COOKIE` is a short-lived proof that the click reached the provider.
 *   It is not a second consent and it is not the analytics cookie.
 * - `/admin/consents` lists the rows and can set `withdrawn_at`. It does not delete them.
 */
export const CONSENT_METHOD = 'sign-in-button'
export const CONSENT_COOKIE = 'k39_oauth_consent'
export const CONSENT_PATH = '/soglasie'

export function consentParamAccepted(consent: unknown, version: unknown) {
  return consent === '1' && version === CONSENT_VERSION
}

export function oauthStartAllowed(input: { consent: unknown; version: unknown; cookie: string | undefined }) {
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
