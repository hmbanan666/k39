import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import handler from '../server/routes/blizkie_lyudi'
import { serverNitroPreamble } from './nuxt-sfc-plugin'

function repoRoot() {
  const candidates = [process.cwd(), resolve(process.cwd(), '../..')]
  return candidates.find((dir) => existsSync(resolve(dir, 'pnpm-workspace.yaml'))) ?? process.cwd()
}

const route = resolve(repoRoot(), 'apps/web-app/server/routes/example.ts')

describe('server nitro auto-imports', () => {
  it('injects h3 helpers a route calls and ignores a mention in prose', () => {
    const prose = 'export const note = "createError is not called here"\n'
    expect(serverNitroPreamble(route, prose)).toBe('')
    const source =
      'export default defineEventHandler(() => {\n  throw createError({ statusCode: 410, statusMessage: "Gone" })\n})\n'
    const preamble = serverNitroPreamble(route, source)
    expect(preamble).toContain("from 'h3'")
    expect(preamble).toContain('createError')
    expect(preamble).toContain('defineEventHandler')
  })

  it('loads a route module that does not import h3 itself', () => {
    expect(typeof handler).toBe('function')
  })
})
