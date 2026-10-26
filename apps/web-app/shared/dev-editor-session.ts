/**
 * Dev-only editor session.
 * A production build, NODE_ENV=production, a missing flag, a non-loopback
 * host, a non-loopback socket, or a token that does not match the local
 * file all refuse. The route returns 404.
 */
export const DEV_EDITOR_EMAIL = 'dev-editor@localhost'

export interface DevEditorSessionInput {
  dev: boolean
  nodeEnv: string | undefined
  flag: string | undefined
  host: string | undefined
  remoteAddress: string | undefined
  tokenMatches: boolean
}

export function devEditorSessionAllowed(input: DevEditorSessionInput) {
  if (!input.dev) {
    return false
  }
  if (input.nodeEnv === 'production') {
    return false
  }
  if (input.flag !== '1') {
    return false
  }
  if (!input.tokenMatches) {
    return false
  }
  if (!isLoopbackHost(input.host)) {
    return false
  }
  if (input.remoteAddress && !isLoopbackAddress(input.remoteAddress)) {
    return false
  }
  return true
}

function isLoopbackHost(host: string | undefined) {
  const name = hostName(host)
  return name === 'localhost' || name === '127.0.0.1' || name === '::1'
}

function isLoopbackAddress(address: string | undefined) {
  if (!address) {
    return false
  }
  let bare = address
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  const zone = bare.indexOf('%')
  if (zone !== -1) {
    bare = bare.slice(0, zone)
  }
  if (bare.startsWith('::ffff:')) {
    bare = bare.slice('::ffff:'.length)
  }
  if (bare === '::1') {
    return true
  }
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(bare)
}

function hostName(host: string | undefined) {
  if (!host) {
    return ''
  }
  const trimmed = host.trim().toLowerCase()
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']')
    return end === -1 ? '' : trimmed.slice(1, end)
  }
  const colon = trimmed.indexOf(':')
  if (colon !== -1 && !trimmed.includes(':', colon + 1)) {
    return trimmed.slice(0, colon)
  }
  return trimmed
}
