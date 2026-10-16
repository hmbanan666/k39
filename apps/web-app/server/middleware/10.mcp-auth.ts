import { getRequestHeader, setResponseHeader, setResponseStatus } from 'h3'
import { CONTENT_BEARER_CHALLENGE, contentRateKey, enterContentScope, resolveContentAuth } from '../utils/access'
import { takeContentSlot } from '../utils/mcp/rate-limit'

function mcpError(statusCode: number, message: string) {
  return {
    jsonrpc: '2.0' as const,
    error: { code: statusCode === 503 ? -32000 : -32001, message },
    id: null,
  }
}

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  if (path !== '/mcp' && !path.startsWith('/mcp/')) {
    return
  }
  if (event.method === 'OPTIONS') {
    return
  }
  const authorization = getRequestHeader(event, 'authorization') ?? ''
  const result = resolveContentAuth(authorization)
  if (!result.ok) {
    setResponseStatus(event, result.statusCode)
    setResponseHeader(event, 'content-type', 'application/json')
    setResponseHeader(event, 'cache-control', 'no-store')
    if (result.statusCode === 401) {
      setResponseHeader(event, 'WWW-Authenticate', CONTENT_BEARER_CHALLENGE)
    }
    return mcpError(result.statusCode, result.statusMessage)
  }
  enterContentScope(result.scope)
  event.context.contentScope = result.scope
  takeContentSlot(contentRateKey(authorization))
})
