import { Buffer } from 'node:buffer'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32 } from 'node:zlib'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import { categoryNames, fallbackQueries, mapCommonsLicense, plainText } from '../server/media/commons'
import { coverSizeWarning } from '../server/media/ingest'
import { MAX_INPUT_PIXELS, MAX_UPLOAD_BYTES, processImage, uploadProblem, uploadStatus } from '../server/media/process'
import { mediaSlotDepth, withMediaSlot } from '../server/media/semaphore'
import { createLocalMediaStorage } from '../server/media/storage'

describe('media storage', () => {
  const roots: string[] = []

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('puts, reads, and deletes a key without leaving the root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'k39-media-'))
    roots.push(root)
    const storage = createLocalMediaStorage(root)
    await storage.put('abc/master.webp', Buffer.from('webp'))
    expect(await storage.exists('abc/master.webp')).toBe(true)
    expect((await storage.get('abc/master.webp'))?.toString()).toBe('webp')
    await storage.delete('abc/master.webp')
    expect(await storage.exists('abc/master.webp')).toBe(false)
    await expect(storage.put('../etc/passwd', Buffer.from('no'))).rejects.toThrow('Unsafe')
  })
})

describe('variant generation', () => {
  const roots: string[] = []

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('writes a capped master, smaller variants, an og crop, and a tiny lqip', async () => {
    const root = await mkdtemp(join(tmpdir(), 'k39-media-'))
    roots.push(root)
    const storage = createLocalMediaStorage(root)
    const source = await sharp({
      create: { width: 3000, height: 1500, channels: 3, background: { r: 180, g: 40, b: 30 } },
    }).jpeg().toBuffer()
    const processed = await processImage(source, 'shot', storage)
    expect(processed.width).toBeLessThanOrEqual(2560)
    expect(processed.variants.some((item) => item.file === '1920.avif')).toBe(true)
    expect(processed.variants.some((item) => item.file === '1920.webp')).toBe(true)
    expect(processed.variants.some((item) => item.width > processed.width)).toBe(false)
    const og = processed.variants.find((item) => item.file === 'og.jpg')
    expect(og?.width).toBeLessThanOrEqual(1200)
    expect(og?.height).toBeLessThanOrEqual(630)
    expect(processed.lqip.startsWith('data:image/webp;base64,')).toBe(true)
    expect(processed.dominantColor).toMatch(/^#[0-9a-f]{6}$/)
    const master = await sharp(await storage.get('shot/master.webp') as Buffer).metadata()
    expect(master.exif).toBeUndefined()
    expect(await storage.exists('shot/320.avif')).toBe(true)
  })

  it('does not upscale a small source', async () => {
    const root = await mkdtemp(join(tmpdir(), 'k39-media-'))
    roots.push(root)
    const storage = createLocalMediaStorage(root)
    const source = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 10, g: 20, b: 30 } },
    }).png().toBuffer()
    const processed = await processImage(source, 'small', storage)
    expect(processed.width).toBe(400)
    expect(processed.variants.some((item) => item.width > 400)).toBe(false)
    expect(processed.variants.some((item) => item.file === '640.webp')).toBe(false)
  })
})

describe('upload semaphore', () => {
  it('keeps two tasks active and lets the third wait', async () => {
    let releaseFirst: () => void = () => {}
    const first = withMediaSlot(() => new Promise<void>((resolve) => {
      releaseFirst = resolve
    }))
    const second = withMediaSlot(() => Promise.resolve('b'))
    await second
    expect(mediaSlotDepth()).toBe(1)
    releaseFirst()
    await first
    expect(mediaSlotDepth()).toBe(0)
  })
})

describe('commons licenses', () => {
  it('keeps CC0, PD, CC BY and CC BY-SA', () => {
    expect(mapCommonsLicense('CC0')).toBe('cc0')
    expect(mapCommonsLicense('Public domain')).toBe('pd')
    expect(mapCommonsLicense('CC BY-SA 4.0')).toBe('cc-by-sa')
    expect(mapCommonsLicense('CC BY 4.0')).toBe('cc-by')
    expect(mapCommonsLicense('CC BY-NC')).toBeNull()
  })

  it('trims a description and lists category names', () => {
    expect(plainText('<p>Fort&nbsp;III</p>')).toBe('Fort III')
    expect(categoryNames({ categories: [{ title: 'Category:Fort VII in Kaliningrad' }, { title: '  ' }] })).toEqual(['Fort VII in Kaliningrad'])
  })

  it('searches an English fort title when the Russian name has a number', () => {
    expect(fallbackQueries('Форт № 7 «Герцог фон Гольштейн»')).toContain('Fort VII Kaliningrad')
  })

  it('warns about a small cover and stays quiet for a gallery photo', () => {
    expect(coverSizeWarning(800, true)).toContain('1200')
    expect(coverSizeWarning(800, false)).toBe('')
    expect(coverSizeWarning(1600, true)).toBe('')
  })
})

function pngChunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([length, body, crc])
}

/** A 1×1 PNG whose header claims a huge frame. The pixel bytes stay tiny. */
async function hugeHeaderPng(width: number, height: number) {
  const tiny = await sharp({
    create: { width: 1, height: 1, channels: 3, background: { r: 200, g: 10, b: 10 } },
  }).png().toBuffer()
  const chunks: Array<{ type: string, data: Buffer }> = []
  let offset = 8
  while (offset < tiny.length) {
    const size = tiny.readUInt32BE(offset)
    const type = tiny.subarray(offset + 4, offset + 8).toString('ascii')
    chunks.push({ type, data: Buffer.from(tiny.subarray(offset + 8, offset + 8 + size)) })
    offset += 12 + size
  }
  const header = chunks.find((chunk) => chunk.type === 'IHDR')
  if (!header) {
    throw new Error('png has no IHDR')
  }
  header.data.writeUInt32BE(width, 0)
  header.data.writeUInt32BE(height, 4)
  return Buffer.concat([tiny.subarray(0, 8), ...chunks.map((chunk) => pngChunk(chunk.type, chunk.data))])
}

describe('upload problems', () => {
  it('maps problem codes to status codes', () => {
    expect(uploadStatus('too_large')).toBe(413)
    expect(uploadStatus('too_many_pixels')).toBe(413)
    expect(uploadStatus('bad_type')).toBe(400)
    expect(uploadStatus('heic')).toBe(400)
    expect(uploadStatus('unreadable')).toBe(400)
  })

  it('rejects corrupt bytes, a lied type, HEIC and an oversize header', async () => {
    const text = await uploadProblem(Buffer.from('this is not a photo'), 'note.jpg')
    expect(text).toMatchObject({ code: 'unreadable', message: 'Не удалось прочитать изображение.' })
    expect(uploadStatus(text!.code)).toBe(400)

    const png = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 1, g: 2, b: 3 } },
    }).png().toBuffer()
    expect(await uploadProblem(png, 'declared.jpg')).toBeNull()

    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
    const lied = await uploadProblem(gif, 'photo.jpg')
    expect(lied?.code).toBe('bad_type')
    expect(uploadStatus(lied!.code)).toBe(400)

    const jpeg = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 9, g: 9, b: 9 } },
    }).jpeg().toBuffer()
    const named = await uploadProblem(jpeg, 'IMG_2043.HEIC')
    expect(named?.code).toBe('heic')
    expect(named?.message).toContain('HEIC')
    const branded = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypheic')])
    branded.writeUInt32BE(branded.length, 0)
    expect((await uploadProblem(branded, 'photo.jpg'))?.code).toBe('heic')

    const huge = await hugeHeaderPng(20_000, 20_000)
    expect(20_000 * 20_000).toBeGreaterThan(MAX_INPUT_PIXELS)
    const started = Date.now()
    const pixels = await uploadProblem(huge, 'frame.png')
    expect(Date.now() - started).toBeLessThan(1000)
    expect(pixels?.code).toBe('too_many_pixels')
    expect(uploadStatus(pixels!.code)).toBe(413)

    const heavy = Buffer.alloc(MAX_UPLOAD_BYTES + 1)
    expect((await uploadProblem(heavy, 'big.jpg'))?.code).toBe('too_large')
  })
})
