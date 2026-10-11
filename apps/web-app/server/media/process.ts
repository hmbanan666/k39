import type { MediaVariant } from '@k39/database'
import type { Buffer } from 'node:buffer'
import type { MediaStorage } from './storage'
import sharp from 'sharp'

const WIDTHS = [320, 640, 960, 1280, 1920]
const MASTER_MAX = 2560

export interface ProcessedImage {
  width: number
  height: number
  bytes: number
  mime: 'image/webp'
  filename: 'master.webp'
  variants: MediaVariant[]
  lqip: string
  dominantColor: string
  sourceWidth: number
  sourceHeight: number
}

export async function processImage(input: Buffer, mediaId: string, storage: MediaStorage): Promise<ProcessedImage> {
  const source = sharp(input, { failOn: 'none' }).rotate()
  const sourceMeta = await source.metadata()
  const sourceWidth = sourceMeta.width ?? 1
  const sourceHeight = sourceMeta.height ?? 1
  const longSide = Math.max(sourceWidth, sourceHeight)
  const scale = longSide > MASTER_MAX ? MASTER_MAX / longSide : 1
  const masterWidth = Math.max(1, Math.round(sourceWidth * scale))
  const masterHeight = Math.max(1, Math.round(sourceHeight * scale))
  const masterBuf = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: masterWidth, height: masterHeight, fit: 'fill', withoutEnlargement: true })
    .toColorspace('srgb')
    .webp({ quality: 90 })
    .toBuffer()
  await storage.put(`${mediaId}/master.webp`, masterBuf)
  const masterMeta = await sharp(masterBuf).metadata()
  const baseWidth = masterMeta.width ?? masterWidth
  const baseHeight = masterMeta.height ?? masterHeight
  const variants: MediaVariant[] = [{
    format: 'webp',
    width: baseWidth,
    height: baseHeight,
    bytes: masterBuf.length,
    file: 'master.webp',
  }]
  const sized = WIDTHS.filter((width) => width < baseWidth)
  const [groups, og, lqipBuf, stats] = await Promise.all([
    Promise.all(sized.map(async (width) => {
      const height = Math.max(1, Math.round(baseHeight * (width / baseWidth)))
      const [avif, webp] = await Promise.all([
        sharp(masterBuf).resize({ width, withoutEnlargement: true }).avif({ quality: 50 }).toBuffer(),
        sharp(masterBuf).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
      ])
      await Promise.all([
        storage.put(`${mediaId}/${width}.avif`, avif),
        storage.put(`${mediaId}/${width}.webp`, webp),
      ])
      return [
        { format: 'avif' as const, width, height, bytes: avif.length, file: `${width}.avif` },
        { format: 'webp' as const, width, height, bytes: webp.length, file: `${width}.webp` },
      ]
    })),
    sharp(masterBuf).resize({
      width: Math.min(1200, baseWidth),
      height: Math.min(630, baseHeight),
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: true,
    }).jpeg({ quality: 90 }).toBuffer(),
    sharp(masterBuf).resize({ width: 16, withoutEnlargement: true }).blur(1).webp({ quality: 40 }).toBuffer(),
    sharp(masterBuf).stats(),
  ])
  for (const pair of groups) {
    variants.push(...pair)
  }
  const ogMeta = await sharp(og).metadata()
  await storage.put(`${mediaId}/og.jpg`, og)
  variants.push({
    format: 'jpeg',
    width: ogMeta.width ?? Math.min(1200, baseWidth),
    height: ogMeta.height ?? Math.min(630, baseHeight),
    bytes: og.length,
    file: 'og.jpg',
  })
  const { r: red, g: green, b: blue } = stats.dominant
  const dominantColor = `#${[red, green, blue].map((part) => Math.max(0, Math.min(255, part)).toString(16).padStart(2, '0')).join('')}`
  return {
    width: baseWidth,
    height: baseHeight,
    bytes: masterBuf.length,
    mime: 'image/webp',
    filename: 'master.webp',
    variants,
    lqip: `data:image/webp;base64,${lqipBuf.toString('base64')}`,
    dominantColor,
    sourceWidth,
    sourceHeight,
  }
}

export const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export function uploadProblem(mime: string, filename: string, bytes: number) {
  const name = filename.toLowerCase()
  if (mime === 'image/heic' || mime === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif')) {
    return 'Формат HEIC не поддерживается. Сохраните фото как JPEG.'
  }
  if (!ACCEPTED_MIME.has(mime)) {
    return 'Нужен файл JPEG, PNG или WebP.'
  }
  if (bytes > MAX_UPLOAD_BYTES) {
    return 'Файл больше 25 МБ.'
  }
  return ''
}
