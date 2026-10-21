export interface StoredRedirect {
  fromPath: string
  toPath: string | null
  statusCode: number
}

export interface RedirectInput {
  hostHeader?: string
  protoHeader?: string
  path: string
  search?: string
  redirects?: StoredRedirect[]
}

export type RedirectDecision
  = | { kind: 'none' }
    | { kind: 'redirect', location: string }
    | { kind: 'gone' }

/**
 * In-memory hop cap. `Content.redirectChain` uses the same number and is what
 * the page middleware loads, one indexed `from_path` lookup per hop.
 */
export const REDIRECT_HOP_LIMIT = 10

const QUEST_SLUGS: Record<string, string> = {
  'five-forts': 'pyat-fortov',
}

function hostnameOf(hostHeader?: string) {
  const first = hostHeader?.split(',')[0]?.trim().toLowerCase() ?? ''
  return first.split(':')[0] ?? ''
}

function isPublicHost(hostname: string) {
  return hostname === 'k39.online' || hostname === 'www.k39.online'
}

export function rewritePath(path: string) {
  const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  const place = /^\/place\/([^/]+)$/.exec(normalized)
  if (place?.[1]) {
    return `/${place[1]}`
  }
  const quest = /^\/quest\/([^/]+)$/.exec(normalized)
  if (quest?.[1]) {
    const slug = QUEST_SLUGS[quest[1]] ?? quest[1]
    return `/kvesty/${slug}`
  }
  return normalized
}

function followRedirects(path: string, redirects: StoredRedirect[]) {
  const byPath = new Map(redirects.map((item) => [item.fromPath, item]))
  const seen = new Set<string>()
  let current = path
  for (let hop = 0; hop < REDIRECT_HOP_LIMIT; hop++) {
    const row = byPath.get(current)
    if (!row || seen.has(current)) {
      break
    }
    seen.add(current)
    if (row.statusCode === 410 || !row.toPath) {
      return { gone: true, path: current }
    }
    current = row.toPath
  }
  return { gone: false, path: current }
}

export function decideRedirect(input: RedirectInput): RedirectDecision {
  const rawHost = input.hostHeader?.split(',')[0]?.trim() || ''
  const hostname = hostnameOf(input.hostHeader)
  const publicHost = isPublicHost(hostname)
  const search = input.search ?? ''
  const rewritten = rewritePath(input.path || '/')
  const followed = followRedirects(rewritten, input.redirects ?? [])
  if (followed.gone) {
    return { kind: 'gone' }
  }
  const originPath = input.path || '/'
  if (publicHost) {
    const originProto = (input.protoHeader || 'https').split(',')[0]?.trim()
    const changed = hostname !== 'k39.online' || originProto === 'http' || originPath !== followed.path
    if (!changed) {
      return { kind: 'none' }
    }
    return { kind: 'redirect', location: `https://k39.online${followed.path}${search}` }
  }
  if (originPath === followed.path) {
    return { kind: 'none' }
  }
  const proto = (input.protoHeader || 'http').split(',')[0]?.trim() || 'http'
  const host = rawHost || 'localhost'
  return { kind: 'redirect', location: `${proto}://${host}${followed.path}${search}` }
}
