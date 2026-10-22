import type { IncomingMessage, ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'
import { createServer, request as httpRequest } from 'node:http'
import { Readable } from 'node:stream'
import { createEvent } from 'h3'
import { describe, expect, it } from 'vitest'
import eventsHandler from '../server/api/events/index.post'
import guestPhoto from '../server/api/guests/photo.post'
import searchEvents from '../server/api/search/events.post'
import { UPLOAD_BODY_MAX, UPLOAD_TOO_LARGE_MESSAGE } from '../server/media/process'
import { readCappedBody, readCappedJson, readUploadForm } from '../server/utils/request-body'

const CAP = 8

function openRequest(headers: Record<string, string> = {}) {
  let dataListeners = 0
  const req = new Readable({
    read() {},
  })
  const originalOn = req.on.bind(req)
  req.on = ((event: string, listener: (...args: unknown[]) => void) => {
    if (event === 'data') {
      dataListeners += 1
    }
    return originalOn(event, listener)
  }) as typeof req.on
  req.headers = headers
  req.method = 'POST'
  req.url = '/'
  const event = createEvent(req as unknown as IncomingMessage, {} as ServerResponse)
  return { req, event, dataListeners: () => dataListeners }
}

async function settled<T>(pending: Promise<T>) {
  return Promise.race([
    pending.then(() => 'accepted' as const, (error: { statusCode?: number }) => error.statusCode ?? 0),
    new Promise<'waited'>((resolve) => {
      setTimeout(() => resolve('waited'), 200)
    }),
  ])
}

describe('capped request body', () => {
  it('refuses a declared length over the cap before reading', async () => {
    const { event, dataListeners } = openRequest({ 'content-length': String(CAP + 1) })
    await expect(readCappedBody(event, CAP)).rejects.toMatchObject({ statusCode: 413, statusMessage: 'Payload Too Large' })
    expect(dataListeners()).toBe(0)
  })

  it('stops a chunked body as soon as it passes the cap', async () => {
    const { req, event } = openRequest({ 'transfer-encoding': 'chunked' })
    const pending = readCappedBody(event, CAP)
    req.push(Buffer.alloc(CAP))
    req.push(Buffer.alloc(1, 1))
    await expect(settled(pending)).resolves.toBe(413)
  })

  it('returns a chunked body within the cap', async () => {
    const { req, event } = openRequest({ 'transfer-encoding': 'chunked' })
    const pending = readCappedBody(event, CAP)
    req.push(Buffer.from('abc'))
    req.push(null)
    await expect(pending).resolves.toEqual(Buffer.from('abc'))
  })

  it('returns a body that is exactly at the cap', async () => {
    const payload = Buffer.alloc(CAP, 0x61)
    const { req, event } = openRequest({ 'content-length': String(CAP) })
    const pending = readCappedBody(event, CAP)
    req.push(payload)
    req.push(null)
    await expect(pending).resolves.toEqual(payload)
  })

  it('treats a missing, zero, or non-numeric length as an empty body', async () => {
    const missing = openRequest()
    await expect(readCappedBody(missing.event, CAP)).resolves.toBeUndefined()
    expect(missing.dataListeners()).toBe(0)

    const zero = openRequest({ 'content-length': '0' })
    await expect(readCappedBody(zero.event, CAP)).resolves.toBeUndefined()
    expect(zero.dataListeners()).toBe(0)

    const garbage = openRequest({ 'content-length': 'nope' })
    await expect(readCappedBody(garbage.event, CAP)).resolves.toBeUndefined()
    expect(garbage.dataListeners()).toBe(0)

    const { req, event } = openRequest({ 'transfer-encoding': 'chunked' })
    const pending = readCappedBody(event, CAP)
    req.push(null)
    await expect(pending).resolves.toEqual(Buffer.alloc(0))
  })

  it('parses json that fits, including a chunked body', async () => {
    const payload = Buffer.from('{"ok":true}')
    const declared = openRequest({
      'content-type': 'application/json',
      'content-length': String(payload.length),
    })
    const declaredPending = readCappedJson<{ ok: boolean }>(declared.event, 100)
    declared.req.push(payload)
    declared.req.push(null)
    await expect(declaredPending).resolves.toEqual({ ok: true })

    const chunked = openRequest({
      'content-type': 'application/json',
      'transfer-encoding': 'chunked',
    })
    const chunkedPending = readCappedJson(chunked.event, payload.length)
    chunked.req.push(payload)
    chunked.req.push(null)
    await expect(chunkedPending).resolves.toEqual({ ok: true })
  })

  it('refuses a declared upload over the file cap before reading', async () => {
    const { event, dataListeners } = openRequest({ 'content-length': String(UPLOAD_BODY_MAX + 1) })
    await expect(readUploadForm(event)).rejects.toMatchObject({
      statusCode: 413,
      statusMessage: UPLOAD_TOO_LARGE_MESSAGE,
    })
    expect(dataListeners()).toBe(0)
  })

  it('accepts a declared upload length exactly at the cap', async () => {
    const { req, event, dataListeners } = openRequest({ 'content-length': String(UPLOAD_BODY_MAX) })
    const pending = readCappedBody(event, UPLOAD_BODY_MAX)
    await Promise.resolve()
    expect(dataListeners()).toBe(1)
    req.push(null)
    await expect(pending).resolves.toEqual(Buffer.alloc(0))
  })

  it('parses a multipart body that fits the cap', async () => {
    const body = Buffer.from('--b\r\nContent-Disposition: form-data; name="consent"\r\n\r\n1\r\n--b--\r\n')
    const { req, event } = openRequest({
      'content-type': 'multipart/form-data; boundary=b',
      'content-length': String(body.length),
    })
    const pending = readUploadForm(event)
    req.push(body)
    req.push(null)
    const parts = await pending
    expect(parts?.find((part) => part.name === 'consent')?.data.toString()).toBe('1')
  })
})

describe('upload route cap', () => {
  it('answers 413 for a chunked photo over the cap without reading the rest', async () => {
    let produced = 0
    const chunk = Buffer.alloc(64 * 1024, 0x61)
    // The socket keeps a few megabytes ahead of the reader. The ceiling is
    // further out, so a handler that buffers until the end fails this check.
    const slack = 8 * 1024 * 1024
    const ceiling = UPLOAD_BODY_MAX + slack * 4
    const body = new Readable({
      read() {
        if (produced >= ceiling) {
          this.push(null)
          return
        }
        this.push(chunk)
        produced += chunk.length
      },
    })
    const response = await post(guestPhoto, '/api/guests/photo', {
      'content-type': 'multipart/form-data; boundary=b',
      'transfer-encoding': 'chunked',
    }, body)
    expect(response.status).toBe(413)
    expect(response.body).toBe(UPLOAD_TOO_LARGE_MESSAGE)
    expect(produced).toBeLessThan(UPLOAD_BODY_MAX + slack)
  }, 20_000)

  it('parses a photo that fits and then asks for the rights confirmation', async () => {
    const body = Buffer.from([
      '--b\r\nContent-Disposition: form-data; name="consent"\r\n\r\n1\r\n',
      '--b--\r\n',
    ].join(''))
    const response = await post(guestPhoto, '/api/guests/photo', {
      'content-type': 'multipart/form-data; boundary=b',
      'content-length': String(body.length),
    }, body)
    expect(response.status).toBe(400)
    expect(response.body).toContain('прав')
  })
})

describe('beacon route caps', () => {
  it('answers 413 for an events body over its cap', async () => {
    const body = Buffer.alloc(3 * 1024, 0x61)
    const response = await post(eventsHandler, '/api/events', {
      'content-type': 'application/json',
      'content-length': String(body.length),
    }, body)
    expect(response.status).toBe(413)
  })

  it('answers 413 for a search beacon over its cap', async () => {
    const body = Buffer.alloc(16 * 1024 + 1, 0x61)
    const response = await post(searchEvents, '/api/search/events', {
      'content-type': 'application/json',
      'content-length': String(body.length),
    }, body)
    expect(response.status).toBe(413)
  })
})

function post(
  handler: (event: ReturnType<typeof createEvent>) => Promise<unknown>,
  path: string,
  headers: Record<string, string>,
  body: Buffer | Readable,
) {
  const server = createServer((req, res) => {
    const event = createEvent(req, res)
    Promise.resolve(handler(event)).catch((error: { statusCode?: number, statusMessage?: string, message?: string }) => {
      if (!res.writableEnded) {
        res.statusCode = error.statusCode || 500
        res.end(error.statusMessage || error.message || '')
      }
    })
  })
  return new Promise<{ status: number, body: string }>((resolve, reject) => {
    let settled = false
    let status = 0
    const finish = (error?: unknown, nextStatus?: number, text?: string) => {
      if (settled) {
        return
      }
      settled = true
      server.close()
      if (error && !nextStatus) {
        reject(error)
        return
      }
      resolve({ status: nextStatus ?? 0, body: text ?? '' })
    }
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      const req = httpRequest({
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers,
      }, (res) => {
        const chunks: Buffer[] = []
        status = res.statusCode ?? 0
        res.on('data', (chunk: Buffer) => {
          chunks.push(Buffer.from(chunk))
        })
        res.on('end', () => {
          finish(undefined, status, Buffer.concat(chunks).toString('utf8'))
        })
      })
      req.on('error', (error) => {
        if (status) {
          finish(undefined, status, '')
          return
        }
        finish(error)
      })
      if (Buffer.isBuffer(body)) {
        req.end(body)
      } else {
        body.pipe(req)
      }
    })
  })
}
