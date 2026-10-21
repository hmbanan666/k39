import type { H3Event } from 'h3'
import { createHmac } from 'node:crypto'
import { getRequestIP } from 'h3'
import { analyticsSalt } from './identity'

const hits = new Map<string, number[]>()

/**
 * In-memory limiter for this Node process. A restart clears the buckets, and
 * each replica counts on its own. Production is one Dokploy container, so
 * that split is acceptable.
 *
 * The key is a hash of the client IP only. The address is not stored.
 * User-Agent is left out: rotating it must not open a new bucket.
 * A mobile gateway or carrier-grade NAT shares one address across many
 * visitors. One browser sends a handful of beacons a minute (the load, then
 * about every 15 seconds while the queue is non-empty, plus hide). 600 a
 * minute is 10 a second, which covers that sharing and still stops a loop.
 */
export const COLLECT_LIMIT = 600
export const COLLECT_WINDOW_MS = 60_000

/** Live addresses kept here. A new address past this cap is refused until the next sweep. */
export const COLLECT_MAX_KEYS = 1024

let sweptAt = Number.NEGATIVE_INFINITY

export function takeCollectSlot(key: string, now = Date.now()) {
  // One pass over the map per window. A flood of new keys must not scan it on every request.
  if (now - sweptAt >= COLLECT_WINDOW_MS) {
    sweep(now)
    sweptAt = now
  }
  const existing = hits.get(key)
  const recent = (existing ?? []).filter((stamp) => now - stamp < COLLECT_WINDOW_MS)
  if (recent.length >= COLLECT_LIMIT) {
    hits.set(key, recent)
    return false
  }
  if (!existing && hits.size >= COLLECT_MAX_KEYS) {
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}

export function resetCollectSlots() {
  hits.clear()
  sweptAt = Number.NEGATIVE_INFINITY
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

/** Hash of the client IP. Rotating the user agent keeps the same bucket. */
export function collectRateKey(event: H3Event) {
  const ip = getRequestIP(event, { xForwardedFor: true }) || ''
  return createHmac('sha256', analyticsSalt()).update(ip).digest('hex').slice(0, 32)
}
