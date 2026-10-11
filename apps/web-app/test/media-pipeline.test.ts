import { Buffer } from 'node:buffer'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import { categoryNames, fallbackQueries, mapCommonsLicense, plainText } from '../server/media/commons'
import { coverSizeWarning } from '../server/media/ingest'
import { processImage } from '../server/media/process'
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
