import type { H3Event, MultiPartData } from 'h3'
import type { IncomingMessage } from 'node:http'
import { Blob, Buffer } from 'node:buffer'
import { createError, readBody, readMultipartFormData } from 'h3'
import { UPLOAD_BODY_MAX, UPLOAD_TOO_LARGE_MESSAGE } from '../media/process'

/**
 * h3 1.15 readRawBody buffers the whole stream and takes no byte cap.
 * Nitro routeRules have no body limit either, so every capped read goes
 * through this helper. A declared Content-Length over the cap is refused
 * before the stream is touched. A chunked body is refused as soon as the
 * cap is passed, and the rest is not buffered.
 */
const RawBodySymbol = Symbol.for('h3RawBody')

type Carrier = IncomingMessage & {
  rawBody?: unknown
  body?: unknown
} & Record<symbol, unknown>

function carrier(req: IncomingMessage) {
  return req as Carrier
}

function headerText(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? ''
  }
  return value ?? ''
}

function declaredLength(req: IncomingMessage) {
  const parsed = Number.parseInt(headerText(req.headers['content-length']), 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function isChunked(req: IncomingMessage) {
  return /\bchunked\b/i.test(headerText(req.headers['transfer-encoding']))
}

function tooLarge(statusMessage: string) {
  return createError({ statusCode: 413, statusMessage })
}

export function isPayloadTooLarge(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    (error as { statusCode?: number }).statusCode === 413
  )
}

async function asBuffer(value: unknown, maxBytes: number, statusMessage: string): Promise<Buffer | undefined> {
  const resolved = await value
  if (Buffer.isBuffer(resolved)) {
    return resolved
  }
  if (resolved instanceof Uint8Array) {
    return Buffer.from(resolved)
  }
  if (resolved instanceof ArrayBuffer) {
    return Buffer.from(resolved)
  }
  if (resolved instanceof Blob) {
    return asBuffer(resolved.stream(), maxBytes, statusMessage)
  }
  if (typeof resolved === 'string') {
    return Buffer.from(resolved)
  }
  if (resolved && typeof resolved === 'object') {
    if (Symbol.asyncIterator in resolved) {
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of resolved as AsyncIterable<Uint8Array | string>) {
        const bytes = Buffer.from(chunk)
        size += bytes.length
        if (size > maxBytes) {
          throw tooLarge(statusMessage)
        }
        chunks.push(bytes)
      }
      return Buffer.concat(chunks)
    }
    if (resolved instanceof URLSearchParams) {
      return Buffer.from(resolved.toString())
    }
    if (resolved instanceof FormData) {
      return asBuffer(new Response(resolved).body, maxBytes, statusMessage)
    }
    if (resolved.constructor === Object) {
      return Buffer.from(JSON.stringify(resolved))
    }
  }
  return undefined
}

async function cachedBody(event: H3Event, maxBytes: number, statusMessage: string) {
  const raw = carrier(event.node.req)
  // Match the installed h3 readRawBody precedence, including Nitro internal
  // requests. An upgrade of h3 must keep the interoperability tests passing.
  const value = event._requestBody || event.web?.request?.body || raw[RawBodySymbol] || raw.rawBody || raw.body
  return asBuffer(value, maxBytes, statusMessage)
}

function stash(event: H3Event, bytes: Buffer) {
  const raw = carrier(event.node.req)
  // h3 internals, pinned to 1.15: readBody/readMultipartFormData must consume
  // these capped bytes, not read an exhausted stream. Recheck on h3 upgrades.
  event._requestBody = bytes as unknown as NonNullable<H3Event['_requestBody']>
  raw[RawBodySymbol] = bytes
  raw.rawBody = bytes
}

function readStream(req: IncomingMessage, maxBytes: number, statusMessage: string) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let settled = false
    const fail = (error: unknown) => {
      if (settled) {
        return
      }
      settled = true
      chunks.length = 0
      // Stop buffering. The 413 response closes the socket; destroying it
      // here would drop that status on a chunked upload.
      req.pause()
      reject(error)
    }
    req.on('error', (error) => {
      fail(error)
    })
    req.on('data', (chunk: Buffer | Uint8Array | string) => {
      if (settled) {
        return
      }
      const piece = typeof chunk === 'string' || !Buffer.isBuffer(chunk) ? Buffer.from(chunk) : chunk
      size += piece.length
      if (size > maxBytes) {
        fail(tooLarge(statusMessage))
        return
      }
      chunks.push(piece)
    })
    req.on('end', () => {
      if (settled) {
        return
      }
      settled = true
      resolve(Buffer.concat(chunks))
    })
  })
}

export async function readCappedBody(event: H3Event, maxBytes: number, statusMessage = 'Payload Too Large') {
  const req = event.node.req
  const cached = await cachedBody(event, maxBytes, statusMessage)
  if (cached) {
    if (cached.length > maxBytes) {
      throw tooLarge(statusMessage)
    }
    stash(event, cached)
    return cached
  }
  const declared = declaredLength(req)
  if (declared !== undefined && declared > maxBytes) {
    throw tooLarge(statusMessage)
  }
  // Same empty-body check as h3 readRawBody: no Content-Length and not chunked.
  if (!declared && !isChunked(req)) {
    return undefined
  }
  const bytes = await readStream(req, maxBytes, statusMessage)
  stash(event, bytes)
  return bytes
}

export async function readCappedJson<T = any>(event: H3Event, maxBytes: number, statusMessage?: string): Promise<T> {
  await readCappedBody(event, maxBytes, statusMessage)
  return readBody<T>(event)
}

/**
 * Admin, cabinet, and content JSON. Article ceilings are 20000 characters,
 * so one megabyte is enough for a save and still stops a chunked body.
 */
export const JSON_BODY_MAX = 1024 * 1024
export const JSON_TOO_LARGE_MESSAGE = 'Сообщение слишком большое.'

export function readJsonBody<T = any>(event: H3Event): Promise<T> {
  return readCappedJson<T>(event, JSON_BODY_MAX, JSON_TOO_LARGE_MESSAGE)
}

/** Multipart upload capped at the 25 MB file plus the form-field slack. */
export async function readUploadForm(event: H3Event): Promise<MultiPartData[] | undefined> {
  await readCappedBody(event, UPLOAD_BODY_MAX, UPLOAD_TOO_LARGE_MESSAGE)
  return readMultipartFormData(event)
}
