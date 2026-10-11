import { Buffer } from 'node:buffer'
import { hkdfSync } from 'node:crypto'
import process from 'node:process'

// Same HKDF inputs as nuxt/server deriveSecret('nuxt-auth-utils:session'):
// SHA-256, salt "nuxt", 32 bytes, hex. nuxt-auth-utils still seals with
// NUXT_SESSION_PASSWORD, so this fills that variable when only the app secret exists.
export const SESSION_SECRET_PURPOSE = 'nuxt-auth-utils:session'

export type SessionSecretSource = 'NUXT_SESSION_PASSWORD' | 'NUXT_APP_SECRET' | 'missing'

export function sessionSecretSource(env: NodeJS.ProcessEnv = process.env): SessionSecretSource {
  if (typeof env.NUXT_SESSION_PASSWORD === 'string' && env.NUXT_SESSION_PASSWORD.length > 0) {
    return 'NUXT_SESSION_PASSWORD'
  }
  if (typeof env.NUXT_APP_SECRET === 'string' && env.NUXT_APP_SECRET.length >= 32) {
    return 'NUXT_APP_SECRET'
  }
  return 'missing'
}

export function deriveSessionPassword(appSecret: string) {
  const bits = hkdfSync('sha256', appSecret, 'nuxt', SESSION_SECRET_PURPOSE, 32)
  return Buffer.from(bits).toString('hex')
}

export function ensureSessionPassword(env: NodeJS.ProcessEnv = process.env) {
  const source = sessionSecretSource(env)
  if (source === 'NUXT_SESSION_PASSWORD') {
    return env.NUXT_SESSION_PASSWORD ?? ''
  }
  if (source === 'NUXT_APP_SECRET' && env.NUXT_APP_SECRET) {
    env.NUXT_SESSION_PASSWORD = deriveSessionPassword(env.NUXT_APP_SECRET)
    return env.NUXT_SESSION_PASSWORD
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('Set NUXT_SESSION_PASSWORD or NUXT_APP_SECRET (32+ characters) for admin sessions.')
  }
  return ''
}
