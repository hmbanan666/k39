import { createError } from 'h3'

const hits = new Map<string, number[]>()
const WINDOW_MS = 60_000

export function takeContentSlot(key: string, limit = 60, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS)
  if (recent.length >= limit) {
    hits.set(key, recent)
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }
  recent.push(now)
  hits.set(key, recent)
  return recent.length
}

export function resetContentSlots() {
  hits.clear()
}
