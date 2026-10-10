export function canonicalRedirect(hostHeader: string | undefined, pathWithQuery: string): string | null {
  if (!hostHeader) {
    return null
  }
  const first = hostHeader.split(',')[0]?.trim().toLowerCase() ?? ''
  const hostname = first.split(':')[0]
  if (hostname !== 'www.k39.online') {
    return null
  }
  const path = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`
  return `https://k39.online${path}`
}
