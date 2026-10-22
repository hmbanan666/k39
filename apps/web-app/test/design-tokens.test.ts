import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = [process.cwd(), resolve(process.cwd(), '../..')].find((dir) => existsSync(resolve(dir, 'pnpm-workspace.yaml')))!
const app = `${root}/apps/web-app/app/`
const css = readFileSync(`${app}assets/css/tokens.css`, 'utf8')
const light = css.match(/:root\s*\{([^}]+)\}/)![1]!
const dark = css.match(/\[data-theme="dark"\]\s*\{([^}]+)\}/)![1]!

function tokens(block: string) {
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[\da-f]{6});/g)].map((match) => [match[1]!, match[2]!]))
}

function luminance(hex: string) {
  const values = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    return entry.isDirectory() ? sources(path) : /\.(?:vue|css)$/.test(path) ? [readFileSync(path, 'utf8')] : []
  })
}

describe('design tokens', () => {
  it('defines every color token used by a component or base rule', () => {
    const defined = new Set([...css.matchAll(/(--color-[\w-]+):/g)].map((match) => match[1]))
    const used = new Set(sources(app).flatMap((text) => [...text.matchAll(/var\((--color-[\w-]+)/g)].map((match) => match[1]!)))
    expect([...used].filter((name) => !defined.has(name))).toEqual([])
  })

  it.each([['light', tokens(light)], ['dark', { ...tokens(light), ...tokens(dark) }]] as const)('keeps documented text pairs at AA in %s tokens', (_theme, palette) => {
    for (const [text, background] of [
      ['ink', 'paper'], ['muted', 'paper'], ['ink', 'surface'], ['muted', 'surface'],
      ['sea', 'paper'], ['surface', 'brick'],
    ]) {
      const a = luminance(palette[`--color-${text}`]!)
      const b = luminance(palette[`--color-${background}`]!)
      const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      expect(contrast, `${text} on ${background}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
