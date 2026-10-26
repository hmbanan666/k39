import { Buffer } from 'node:buffer'
import { realpathSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** Paper token. Apple touch and the maskable icon flatten onto this. */
export const PAPER = '#F5EEE1'

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

/**
 * Side of the square inscribed in the maskable safe circle.
 * The circle diameter is 80% of the canvas, so the square's diagonal is that
 * diameter and the artwork is not clipped by a circular mask.
 */
export function maskableSafeSide(canvas = 512) {
  return Math.floor((canvas * 0.8) / Math.SQRT2)
}

/**
 * Multi-size ICO whose images are PNG frames (16, 32, 48 in this set).
 * @param {Array<{ size: number, png: Buffer }>} frames
 */
export function writeIco(frames) {
  if (!frames.length) {
    throw new Error('writeIco needs at least one frame')
  }
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)
  const directory = Buffer.alloc(16 * frames.length)
  let offset = 6 + directory.length
  const parts = [header, directory]
  frames.forEach((frame, index) => {
    if (!Buffer.isBuffer(frame.png) || frame.png.length === 0) {
      throw new Error(`writeIco frame ${frame.size} is empty`)
    }
    const at = index * 16
    const side = frame.size >= 256 ? 0 : frame.size
    directory[at] = side
    directory[at + 1] = side
    directory.writeUInt16LE(1, at + 4)
    directory.writeUInt16LE(32, at + 6)
    directory.writeUInt32LE(frame.png.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += frame.png.length
    parts.push(frame.png)
  })
  return Buffer.concat(parts)
}

export function todayVersion(now = new Date()) {
  return now.toISOString().slice(0, 10).replaceAll('-', '')
}

/**
 * One version string, written into seo.ts and into every manifest icon `?v=`.
 * @param {string} seoSource
 * @param {string} manifestSource
 * @param {string} version
 */
export function bumpBrandIconVersion(seoSource, manifestSource, version) {
  if (!/^\d{8}$/.test(version)) {
    throw new Error(`brand icon version must be YYYYMMDD, got ${version}`)
  }
  const found = seoSource.match(/export const BRAND_ICON_VERSION = '\d{8}'/g) ?? []
  if (found.length !== 1) {
    throw new Error('seo.ts must contain one BRAND_ICON_VERSION assignment')
  }
  const seo = seoSource.replace(
    /export const BRAND_ICON_VERSION = '\d{8}'/,
    `export const BRAND_ICON_VERSION = '${version}'`,
  )
  const manifest = JSON.parse(manifestSource)
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    throw new Error('site.webmanifest has no icons')
  }
  for (const icon of manifest.icons) {
    const path = String(icon.src ?? '').split('?')[0]
    if (!path.startsWith('/')) {
      throw new Error(`manifest icon src must be a root path, got ${icon.src}`)
    }
    icon.src = `${path}?v=${version}`
  }
  return {
    seo,
    manifest: `${JSON.stringify(manifest, null, 2)}\n`,
  }
}

async function containPng(input, size, background) {
  return sharp(input)
    .resize(size, size, {
      fit: 'contain',
      background: background ?? TRANSPARENT,
    })
    .png()
    .toBuffer()
}

async function flattenPng(input, size) {
  return sharp(input)
    .resize(size, size, { fit: 'contain', background: PAPER })
    .flatten({ background: PAPER })
    .removeAlpha()
    .png()
    .toBuffer()
}

async function maskablePng(input) {
  const canvas = 512
  const side = maskableSafeSide(canvas)
  const inner = await containPng(input, side, TRANSPARENT)
  return sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: PAPER,
    },
  })
    .composite([{ input: inner, gravity: 'centre' }])
    .flatten({ background: PAPER })
    .removeAlpha()
    .png()
    .toBuffer()
}

export async function renderBrandIcons(masterPath, outDir) {
  const png16 = await containPng(masterPath, 16)
  const png32 = await containPng(masterPath, 32)
  const png48 = await containPng(masterPath, 48)
  const files = {
    'favicon-16.png': png16,
    'favicon-32.png': png32,
    'favicon.ico': writeIco([
      { size: 16, png: png16 },
      { size: 32, png: png32 },
      { size: 48, png: png48 },
    ]),
    'apple-touch-icon.png': await flattenPng(masterPath, 180),
    'icon-192.png': await containPng(masterPath, 192),
    'icon-512.png': await containPng(masterPath, 512),
    'icon-maskable-512.png': await maskablePng(masterPath),
  }
  await mkdir(outDir, { recursive: true })
  await Promise.all(Object.entries(files).map(([name, body]) => writeFile(join(outDir, name), body)))
  return files
}

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) {
    return false
  }
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href
  } catch {
    return false
  }
}

function parseArgs(argv) {
  const options = {
    out: join(ROOT, 'apps/web-app/public'),
    seo: join(ROOT, 'apps/web-app/shared/seo.ts'),
    manifest: join(ROOT, 'apps/web-app/public/site.webmanifest'),
    version: todayVersion(),
  }
  const rest = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--out' || arg === '--seo' || arg === '--manifest' || arg === '--version') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error(`${arg} needs a value`)
      }
      options[arg.slice(2)] = value
      index += 1
      continue
    }
    rest.push(arg)
  }
  if (rest.length !== 1) {
    throw new Error(
      'usage: node scripts/brand/render-icons.mjs <master> [--out dir] [--seo file] [--manifest file] [--version YYYYMMDD]',
    )
  }
  return { master: rest[0], ...options }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const seoSource = await readFile(args.seo, 'utf8')
  const manifestSource = await readFile(args.manifest, 'utf8')
  const bumped = bumpBrandIconVersion(seoSource, manifestSource, args.version)
  await renderBrandIcons(args.master, args.out)
  await writeFile(args.seo, bumped.seo)
  await writeFile(args.manifest, bumped.manifest)
  process.stdout.write(`brand icons written to ${args.out} at version ${args.version}\n`)
}

if (isDirectRun()) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
