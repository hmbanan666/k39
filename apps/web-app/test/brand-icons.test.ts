import { Buffer } from 'node:buffer'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import {
  bumpBrandIconVersion,
  maskableSafeSide,
  renderBrandIcons,
  writeIco,
} from '../../../scripts/brand/render-icons.mjs'

const dirs: string[] = []

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'k39-brand-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('ico writer', () => {
  it('packs png frames with a real icon directory', () => {
    const png16 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1])
    const png32 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 2, 2])
    const ico = writeIco([
      { size: 16, png: png16 },
      { size: 32, png: png32 },
    ])
    expect(ico.readUInt16LE(0)).toBe(0)
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBe(2)
    expect(ico[6]).toBe(16)
    expect(ico[7]).toBe(16)
    expect(ico.readUInt16LE(10)).toBe(1)
    expect(ico.readUInt16LE(12)).toBe(32)
    expect(ico.readUInt32LE(14)).toBe(png16.length)
    const offset16 = ico.readUInt32LE(18)
    expect(ico.subarray(offset16, offset16 + png16.length)).toEqual(png16)
    const offset32 = ico.readUInt32LE(18 + 16)
    expect(ico.subarray(offset32, offset32 + png32.length)).toEqual(png32)
  })
})

describe('brand icon version', () => {
  it('writes one version into seo.ts and every manifest icon', () => {
    const seo = "export const OTHER = 1\nexport const BRAND_ICON_VERSION = '20261017'\n"
    const manifest = `${JSON.stringify(
      {
        name: 'К39',
        icons: [
          { src: '/icon-192.png?v=20261017', sizes: '192x192', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' },
        ],
        theme_color: '#A3402A',
      },
      null,
      2,
    )}\n`
    const next = bumpBrandIconVersion(seo, manifest, '20261021')
    expect(next.seo).toContain('export const OTHER = 1')
    expect(next.seo).toContain("export const BRAND_ICON_VERSION = '20261021'")
    expect(next.seo).not.toContain('20261017')
    const parsed = JSON.parse(next.manifest) as { icons: Array<{ src: string; purpose?: string }>; theme_color: string }
    expect(parsed.theme_color).toBe('#A3402A')
    expect(parsed.icons.map((icon) => icon.src)).toEqual([
      '/icon-192.png?v=20261021',
      '/icon-maskable-512.png?v=20261021',
    ])
    expect(parsed.icons[1]?.purpose).toBe('maskable')
  })
})

describe('render brand icons', () => {
  it('writes the icon set from a master without touching the repo copies', async () => {
    const root = scratch()
    const master = join(root, 'master.png')
    const inner = await sharp({
      create: { width: 32, height: 32, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } },
    })
      .png()
      .toBuffer()
    await sharp({
      create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: inner, gravity: 'centre' }])
      .png()
      .toFile(master)

    const out = join(root, 'out')
    const files = await renderBrandIcons(master, out)
    expect(maskableSafeSide()).toBe(289)

    const meta = async (name: string) => sharp(join(out, name)).metadata()
    expect((await meta('favicon-16.png')).width).toBe(16)
    expect((await meta('favicon-32.png')).hasAlpha).toBe(true)
    expect((await meta('apple-touch-icon.png')).width).toBe(180)
    expect((await meta('apple-touch-icon.png')).hasAlpha).toBe(false)
    expect((await meta('icon-192.png')).width).toBe(192)
    expect((await meta('icon-512.png')).width).toBe(512)
    expect((await meta('icon-maskable-512.png')).width).toBe(512)
    expect((await meta('icon-maskable-512.png')).hasAlpha).toBe(false)

    const paper = await sharp(join(out, 'icon-maskable-512.png')).raw().toBuffer()
    expect([...paper.subarray(0, 3)]).toEqual([245, 238, 225])
    const apple = await sharp(join(out, 'apple-touch-icon.png')).raw().toBuffer()
    expect([...apple.subarray(0, 3)]).toEqual([245, 238, 225])
    const small = await sharp(join(out, 'favicon-32.png')).ensureAlpha().raw().toBuffer()
    expect(small[3]).toBe(0)

    const ico = readFileSync(join(out, 'favicon.ico'))
    expect(ico.readUInt16LE(4)).toBe(3)
    const frame = (index: number) => {
      const at = 6 + index * 16
      const length = ico.readUInt32LE(at + 8)
      const offset = ico.readUInt32LE(at + 12)
      return ico.subarray(offset, offset + length)
    }
    expect(Buffer.from(frame(0))).toEqual(files['favicon-16.png'])
    expect(Buffer.from(frame(1))).toEqual(files['favicon-32.png'])
    expect((await sharp(frame(2)).metadata()).width).toBe(48)

    const seoPath = join(root, 'seo.ts')
    const manifestPath = join(root, 'site.webmanifest')
    writeFileSync(seoPath, "export const BRAND_ICON_VERSION = '20261017'\n")
    writeFileSync(
      manifestPath,
      `${JSON.stringify({ icons: [{ src: '/icon-192.png?v=20261017', sizes: '192x192' }] })}\n`,
    )
    const bumped = bumpBrandIconVersion(readFileSync(seoPath, 'utf8'), readFileSync(manifestPath, 'utf8'), '20261021')
    expect(bumped.seo).toContain("'20261021'")
    expect(bumped.manifest).toContain('/icon-192.png?v=20261021')
  })
})
