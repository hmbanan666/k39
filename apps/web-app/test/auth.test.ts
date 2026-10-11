import { webcrypto } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { deriveSessionPassword, ensureSessionPassword, sessionSecretSource } from '../server/utils/session-secret'
import { adminRedirect } from '../shared/auth'

describe('admin guard', () => {
  it('sends anonymous visitors to sign-in and keeps the return path', () => {
    expect(adminRedirect(null)).toBe('/sign-in?redirectTo=/admin')
    expect(adminRedirect(undefined)).toBe('/sign-in?redirectTo=/admin')
  })

  it('lets editors and admins in and sends everyone else home', () => {
    expect(adminRedirect({ role: 'admin' })).toBeNull()
    expect(adminRedirect({ role: 'editor' })).toBeNull()
    expect(adminRedirect({ role: 'user' })).toBe('/')
  })
})

describe('session secret', () => {
  const previous = {
    password: process.env.NUXT_SESSION_PASSWORD,
    app: process.env.NUXT_APP_SECRET,
    nodeEnv: process.env.NODE_ENV,
  }

  afterEach(() => {
    restore('NUXT_SESSION_PASSWORD', previous.password)
    restore('NUXT_APP_SECRET', previous.app)
    restore('NODE_ENV', previous.nodeEnv)
  })

  it('keeps an existing session password so current cookies still open', () => {
    const env = { NUXT_SESSION_PASSWORD: 'existing-session-password-32-chars', NUXT_APP_SECRET: 'a'.repeat(32) }
    expect(sessionSecretSource(env)).toBe('NUXT_SESSION_PASSWORD')
    expect(ensureSessionPassword(env)).toBe('existing-session-password-32-chars')
  })

  it('derives the session password from NUXT_APP_SECRET the same way nuxt deriveSecret does', async () => {
    const appSecret = 'a'.repeat(40)
    const env = { NUXT_APP_SECRET: appSecret }
    expect(sessionSecretSource(env)).toBe('NUXT_APP_SECRET')
    const password = ensureSessionPassword(env)
    expect(password).toHaveLength(64)
    expect(env.NUXT_SESSION_PASSWORD).toBe(password)
    expect(ensureSessionPassword(env)).toBe(password)

    const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), 'HKDF', false, ['deriveBits'])
    const bits = await webcrypto.subtle.deriveBits({
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('nuxt'),
      info: new TextEncoder().encode('nuxt-auth-utils:session'),
    }, key, 256)
    const hex = [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    expect(password).toBe(hex)
    expect(password).toBe(deriveSessionPassword(appSecret))
  })

  it('refuses to boot production without either secret', () => {
    expect(sessionSecretSource({})).toBe('missing')
    expect(() => ensureSessionPassword({ NODE_ENV: 'production' })).toThrow(/NUXT_SESSION_PASSWORD or NUXT_APP_SECRET/)
    expect(ensureSessionPassword({ NODE_ENV: 'development' })).toBe('')
  })
})

function restore(key: 'NUXT_SESSION_PASSWORD' | 'NUXT_APP_SECRET' | 'NODE_ENV', value: string | undefined) {
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}
