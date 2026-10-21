import type { H3Event } from 'h3'
import { getRequestHeader, getRequestIP } from 'h3'
import { analyticsSalt, dailyVisitorKey } from './identity'

const hits = new Map<string, number[]>()

/**
 * collect.js sends one beacon on load, then at most one every 15 seconds
 * while the tab is open, plus one when the tab hides. Scroll does not send
 * its own beacon. Several tabs share this key. Sixty a minute is about one
 * a second, which that pattern does not reach, and it stops a client from
 * turning each beacon into a fresh burst of path lookups.
 */
export const COLLECT_LIMIT = 60
export const COLLECT_WINDOW_MS = 60_000

const SWEEP_AT = 4_096

export function takeCollectSlot(key: string, now = Date.now()) {
  if (hits.size > SWEEP_AT) {
    sweep(now)
  }
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < COLLECT_WINDOW_MS)
  if (recent.length >= COLLECT_LIMIT) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}

export function resetCollectSlots() {
  hits.clear()
}

function sweep(now: number) {
  for (const [key, stamps] of hits) {
    const recent = stamps.filter((stamp) => now - stamp < COLLECT_WINDOW_MS)
    if (recent.length === 0) {
      hits.delete(key)
    } else if (recent.length !== stamps.length) {
      hits.set(key, recent)
    }
  }
}

/**
 * Daily visitor key (salt, day, IP, user agent). The IP is not stored.
 * A client that rotates k39_vid stays in the same bucket.
 */
export function collectRateKey(event: H3Event, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10)
  const ip = getRequestIP(event, { xForwardedFor: true }) || ''
  const ua = getRequestHeader(event, 'user-agent') || ''
  return dailyVisitorKey(analyticsSalt(), day, ip, ua)
}
