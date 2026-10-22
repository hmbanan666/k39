import type { MediaVariant } from '@k39/database'
import type { Buffer } from 'node:buffer'
import type { MediaStorage } from './storage'
import sharp from 'sharp'

const WIDTHS = [320, 640, 960, 1280, 1920]
const MASTER_MAX = 2560

// 40 megapixels. A phone frame is about 12 MP and a high-end camera stays
// under 40. Sharp's default is about 268 MP, and two decodes at that size
// can exhaust the container. The same cap is passed to every sharp() call.
// metadata() trusts the header, so an oversize frame is refused before decode.
export const MAX_INPUT_PIXELS = 40_000_000
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

// The multipart body also carries the alt and the consent fields.
// readUploadForm enforces this cap. h3 1.15 readRawBody has no byte cap,
// and Nitro routeRules cannot set one.
export const UPLOAD_BODY_SLACK = 256 * 1024
export const UPLOAD_BODY_MAX = MAX_UPLOAD_BYTES + UPLOAD_BODY_SLACK
export const UPLOAD_TOO_LARGE_MESSAGE = 'Файл больше 25 МБ.'

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp'])
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'heif', 'mif1', 'msf1'])

export type UploadProblemCode = 'too_large' | 'bad_type' | 'heic' | 'unreadable' | 'too_many_pixels'

export interface UploadProblem {
  code: UploadProblemCode
  message: string
}

const PROBLEM_TEXT: Record<UploadProblemCode, string> = {
  too_large: UPLOAD_TOO_LARGE_MESSAGE,
  bad_type: 'Нужен файл JPEG, PNG или WebP.',
  heic: 'Формат HEIC не поддерживается. Сохраните фото как JPEG.',
  unreadable: 'Не удалось прочитать изображение.',
  too_many_pixels: `Изображение больше ${MAX_INPUT_PIXELS / 1_000_000} мегапикселей.`,
}

const PROBLEM_STATUS: Record<UploadProblemCode, 400 | 413> = {
  too_large: 413,
  too_many_pixels: 413,
  bad_type: 400,
  heic: 400,
  unreadable: 400,
}

function problem(code: UploadProblemCode): UploadProblem {
  return { code, message: PROBLEM_TEXT[code] }
}

export function uploadStatus(code: UploadProblemCode) {
  return PROBLEM_STATUS[code]
}

function openImage(input: Buffer) {
  return sharp(input, { failOn: 'none', limitInputPixels: MAX_INPUT_PIXELS })
}

function isHeic(filename: string, bytes: Buffer) {
  const name = filename.toLowerCase()
  if (name.endsWith('.heic') || name.endsWith('.heif')) {
    return true
  }
  if (bytes.length < 12 || bytes.toString('ascii', 4, 8) !== 'ftyp') {
    return false
  }
  return HEIC_BRANDS.has(bytes.toString('ascii', 8, 12).toLowerCase())
}

function isPixelLimitError(error: unknown) {
  return error instanceof Error && error.message.includes('pixel limit')
}

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
  const source = openImage(input).rotate()
  const sourceMeta = await source.metadata()
  const sourceWidth = sourceMeta.width ?? 1
  const sourceHeight = sourceMeta.height ?? 1
  const longSide = Math.max(sourceWidth, sourceHeight)
  const scale = longSide > MASTER_MAX ? MASTER_MAX / longSide : 1
  const masterWidth = Math.max(1, Math.round(sourceWidth * scale))
  const masterHeight = Math.max(1, Math.round(sourceHeight * scale))
  const masterBuf = await openImage(input)
    .rotate()
    .resize({ width: masterWidth, height: masterHeight, fit: 'fill', withoutEnlargement: true })
    .toColorspace('srgb')
    .webp({ quality: 90 })
    .toBuffer()
  await storage.put(`${mediaId}/master.webp`, masterBuf)
  const masterMeta = await openImage(masterBuf).metadata()
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
        openImage(masterBuf).resize({ width, withoutEnlargement: true }).avif({ quality: 50 }).toBuffer(),
        openImage(masterBuf).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
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
    openImage(masterBuf).resize({
      width: Math.min(1200, baseWidth),
      height: Math.min(630, baseHeight),
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: true,
    }).jpeg({ quality: 90 }).toBuffer(),
    openImage(masterBuf).resize({ width: 16, withoutEnlargement: true }).blur(1).webp({ quality: 40 }).toBuffer(),
    openImage(masterBuf).stats(),
  ])
  for (const pair of groups) {
    variants.push(...pair)
  }
  const ogMeta = await openImage(og).metadata()
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

/**
 * Format comes from the decoded header, not from the client MIME.
 * Returns null when the bytes are a JPEG, PNG or WebP inside the limits.
 */
export async function uploadProblem(bytes: Buffer, filename: string): Promise<UploadProblem | null> {
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return problem('too_large')
  }
  if (isHeic(filename, bytes)) {
    return problem('heic')
  }
  try {
    const meta = await openImage(bytes).metadata()
    if (meta.format === 'heif') {
      return problem('heic')
    }
    const pixels = (meta.width ?? 0) * (meta.height ?? 0)
    if (!meta.format || pixels < 1) {
      return problem('unreadable')
    }
    if (pixels > MAX_INPUT_PIXELS) {
      return problem('too_many_pixels')
    }
    if (!ACCEPTED_FORMATS.has(meta.format)) {
      return problem('bad_type')
    }
    return null
  } catch (error) {
    if (isPixelLimitError(error)) {
      return problem('too_many_pixels')
    }
    return problem('unreadable')
  }
}
