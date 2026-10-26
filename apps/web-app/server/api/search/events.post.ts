import { db, isSearchSurface, normalizeSearchQuery, SEARCH_QUERY_MAX } from '@k39/database'
import { parseUserAgent } from '../../../shared/analytics'
import { analyticsSalt, dailyVisitorKey } from '../../utils/analytics/identity'
import { editorRequest } from '../../utils/analytics/ingest'

const SESSION_MS = 30 * 60 * 1000
const ID = /^[\w-]{8,64}$/

interface ClientSearchEvent {
  type?: string
  id?: string
  q?: string
  count?: number
  surface?: string
  position?: number
  path?: string
}

// Search and click events (ADR 0030). Cookieless like ADR 0013: the daily
// HMAC visitor key, and the session of the visitor's latest page view.
// The handler keeps ten events. Each one is an id, a query, and a path.
const SEARCH_EVENT_BODY_MAX = 16 * 1024

export default defineEventHandler(async (event) => {
  const body = await readCappedJson<{ events?: ClientSearchEvent[] }>(event, SEARCH_EVENT_BODY_MAX).catch(
    (error: unknown) => {
      if (isPayloadTooLarge(error)) {
        throw error
      }
      return null
    },
  )
  const incoming = Array.isArray(body?.events) ? body.events.slice(0, 10) : []
  if (!incoming.length || (await editorRequest(event))) {
    return { ok: true, stored: 0 }
  }
  const ua = getHeader(event, 'user-agent') || ''
  const ip = getRequestIP(event, { xForwardedFor: true }) || ''
  const now = Date.now()
  const visitorKey = dailyVisitorKey(analyticsSalt(), new Date(now).toISOString().slice(0, 10), ip, ua)
  const latest = await db.analytics.latestSession(visitorKey)
  const sessionKey = latest && now - new Date(latest.occurredAt).getTime() < SESSION_MS ? latest.sessionKey : null
  const isBot = parseUserAgent(ua).bot
  const rows = []
  for (const item of incoming) {
    if (!item.id || !ID.test(item.id)) {
      continue
    }
    if (item.type === 'search') {
      const query = String(item.q ?? '')
        .trim()
        .slice(0, SEARCH_QUERY_MAX)
      const normalized = normalizeSearchQuery(query)
      if (!normalized) {
        continue
      }
      rows.push({
        searchId: item.id,
        eventType: 'search' as const,
        visitorKey,
        sessionKey,
        isBot,
        surface: isSearchSurface(item.surface) ? item.surface : 'page',
        query,
        normalized,
        resultCount: Math.max(0, Math.min(1000, Math.round(Number(item.count) || 0))),
      })
    } else if (item.type === 'click') {
      const position = Math.round(Number(item.position) || 0)
      const path = String(item.path ?? '')
      if (position < 1 || position > 100 || !path.startsWith('/')) {
        continue
      }
      rows.push({
        searchId: item.id,
        eventType: 'click' as const,
        visitorKey,
        sessionKey,
        isBot,
        position,
        resultPath: path.slice(0, 300),
      })
    }
  }
  const stored = rows.length ? await db.search.insertEvents(rows) : 0
  return { ok: true, stored }
})
