import type { H3Event } from 'h3'
import type { HitEntity } from '../../../shared/analytics'
import { Buffer } from 'node:buffer'
import { createError, getRequestHeader } from 'h3'
import { z } from 'zod'
import { COLLECT_TYPES } from '../../../shared/analytics'

/** Same cap as analytics_hits.path. */
export const COLLECT_PATH_MAX = 500
export const COLLECT_REF_MAX = 500
export const COLLECT_ENTITY_MAX = 500
export const COLLECT_TARGET_MAX = 300
export const COLLECT_LANG_MAX = 12

/**
 * public/collect.js flushes when the queue passes 12, so one beacon holds at
 * most 13 events. The splice(0, 20) in that file never sees a longer queue.
 */
export const COLLECT_EVENT_CAP = 13

/**
 * Thirteen events with every string at its cap is about 24KB plus JSON.
 * Anything larger is refused before it is parsed.
 */
export const COLLECT_BODY_MAX = 32 * 1024

const ENTITY_TYPES = new Set(['impression', 'directions', 'pin_impression', 'pin_click'])
const TYPES = new Set<string>(COLLECT_TYPES)

export interface CollectEvent {
  type: string
  path?: string
  ref?: string
  entity?: string
  target?: string
  lang?: string
  w?: string | number
  ms?: string | number
  scroll?: string | number
}

function cappedString(max: number) {
  return z.unknown().transform((value): string | undefined => {
    if (typeof value !== 'string') {
      return undefined
    }
    return value.slice(0, max)
  }).optional()
}

function looseScalar(max: number) {
  return z.unknown().transform((value): string | number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string') {
      return value.slice(0, max)
    }
    return undefined
  }).optional()
}

const collectEventSchema = z.object({
  type: cappedString(40),
  path: cappedString(COLLECT_PATH_MAX),
  ref: cappedString(COLLECT_REF_MAX),
  entity: cappedString(COLLECT_ENTITY_MAX),
  target: cappedString(COLLECT_TARGET_MAX),
  lang: cappedString(COLLECT_LANG_MAX),
  w: looseScalar(16),
  ms: looseScalar(32),
  scroll: looseScalar(32),
})

export function collectBodyTooLarge(bytes: number) {
  return Number.isFinite(bytes) && bytes > COLLECT_BODY_MAX
}

export function collectBodyDeclaredTooLarge(header: string | undefined) {
  if (!header) {
    return false
  }
  return collectBodyTooLarge(Number.parseInt(header, 10))
}

/**
 * Accepts `{ events: [...] }` or a bare array. Non-strings are dropped.
 * Over-long strings are truncated. Unknown event types are dropped.
 */
export function normalizeCollectEvents(input: unknown): CollectEvent[] {
  const raw = Array.isArray(input)
    ? input
    : (input && typeof input === 'object' && Array.isArray((input as { events?: unknown }).events)
        ? (input as { events: unknown[] }).events
        : [])
  const events: CollectEvent[] = []
  for (const item of raw) {
    if (events.length >= COLLECT_EVENT_CAP) {
      break
    }
    const parsed = collectEventSchema.safeParse(item)
    if (!parsed.success || !parsed.data.type || !TYPES.has(parsed.data.type)) {
      continue
    }
    events.push({
      type: parsed.data.type,
      path: parsed.data.path,
      ref: parsed.data.ref,
      entity: parsed.data.entity,
      target: parsed.data.target,
      lang: parsed.data.lang,
      w: parsed.data.w,
      ms: parsed.data.ms,
      scroll: parsed.data.scroll,
    })
  }
  return events
}

export function collectsPageSubject(type: string) {
  return type === 'pageview' || ENTITY_TYPES.has(type)
}

export function entityLookupPath(entity: string | undefined) {
  const path = (entity ?? '').trim().split('?')[0] ?? ''
  return path.startsWith('/') ? path : ''
}

/** Paths resolvePath would have been asked for, each string once. */
export function collectLookupPaths(events: CollectEvent[], fallbackPath: string) {
  const paths: string[] = []
  const seen = new Set<string>()
  const add = (value: string) => {
    if (!value || seen.has(value)) {
      return
    }
    seen.add(value)
    paths.push(value)
  }
  for (const item of events) {
    const path = (item.path || fallbackPath).slice(0, COLLECT_PATH_MAX)
    if (collectsPageSubject(item.type)) {
      add(path)
    }
    if (item.type === 'impression' && item.target) {
      add(item.target)
    }
    add(entityLookupPath(item.entity))
  }
  return paths
}

/**
 * One resolver call per request. The resolver is Analytics.resolvePaths in
 * production (a single `= any(...)` query) and a fake in tests.
 */
export async function resolveCollectSubjects(
  events: CollectEvent[],
  fallbackPath: string,
  resolvePaths: (paths: string[]) => Promise<Map<string, HitEntity>>,
) {
  const paths = collectLookupPaths(events, fallbackPath)
  if (!paths.length) {
    return new Map<string, HitEntity>()
  }
  return resolvePaths(paths)
}

export async function readCollectJson(event: H3Event): Promise<unknown> {
  if (collectBodyDeclaredTooLarge(getRequestHeader(event, 'content-length'))) {
    event.node.req.destroy()
    throw createError({ statusCode: 413, statusMessage: 'Payload Too Large' })
  }
  const raw = await readBoundedUtf8(event, COLLECT_BODY_MAX)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function readBoundedUtf8(event: H3Event, max: number): Promise<string | undefined> {
  const req = event.node.req
  const chunked = /\bchunked\b/i.test(String(req.headers['transfer-encoding'] ?? ''))
  const declared = Number.parseInt(req.headers['content-length'] || '', 10)
  if (!declared && !chunked) {
    return Promise.resolve(undefined)
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let settled = false
    const fail = (error: unknown) => {
      if (settled) {
        return
      }
      settled = true
      req.destroy()
      reject(error)
    }
    req.on('error', (error) => {
      fail(error)
    })
    req.on('data', (chunk: Buffer) => {
      if (settled) {
        return
      }
      size += chunk.length
      if (size > max) {
        fail(createError({ statusCode: 413, statusMessage: 'Payload Too Large' }))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) {
        return
      }
      settled = true
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
  })
}
