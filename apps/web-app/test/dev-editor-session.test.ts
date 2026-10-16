import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { devEditorTokenMatches } from '../server/utils/dev-editor-token'
import { devEditorSessionAllowed } from '../shared/dev-editor-session'

function repoRoot() {
  const candidates = [process.cwd(), resolve(process.cwd(), '../..')]
  return candidates.find((dir) => existsSync(resolve(dir, 'pnpm-workspace.yaml'))) ?? process.cwd()
}

const cli = resolve(repoRoot(), 'scripts/dev-editor-session.mjs')

function allowed(overrides: Partial<Parameters<typeof devEditorSessionAllowed>[0]> = {}) {
  return devEditorSessionAllowed({
    dev: true,
    nodeEnv: 'development',
    flag: '1',
    host: '127.0.0.1:3000',
    remoteAddress: '127.0.0.1',
    tokenMatches: true,
    ...overrides,
  })
}

describe('dev editor session guard', () => {
  it('allows a local nuxt dev request when the flag and token match', () => {
    expect(allowed()).toBe(true)
    expect(allowed({ host: 'localhost' })).toBe(true)
    expect(allowed({ host: '[::1]:3000', remoteAddress: '::1' })).toBe(true)
    expect(allowed({ remoteAddress: '::ffff:127.0.0.1' })).toBe(true)
    expect(allowed({ remoteAddress: undefined })).toBe(true)
  })

  it('refuses production, a missing flag, a public host, and a bad token', () => {
    expect(allowed({ dev: false })).toBe(false)
    expect(allowed({ nodeEnv: 'production' })).toBe(false)
    expect(allowed({ nodeEnv: undefined })).toBe(true)
    expect(allowed({ flag: undefined })).toBe(false)
    expect(allowed({ flag: 'true' })).toBe(false)
    expect(allowed({ flag: '1 ' })).toBe(false)
    expect(allowed({ host: 'k39.online' })).toBe(false)
    expect(allowed({ host: 'localhost.evil.com' })).toBe(false)
    expect(allowed({ host: undefined })).toBe(false)
    expect(allowed({ remoteAddress: '10.0.0.8' })).toBe(false)
    expect(allowed({ tokenMatches: false })).toBe(false)
  })
})

describe('dev editor token', () => {
  it('matches only an equal secret', () => {
    expect(devEditorTokenMatches('abc', 'abc')).toBe(true)
    expect(devEditorTokenMatches('abc', 'abd')).toBe(false)
    expect(devEditorTokenMatches('abc', 'abcd')).toBe(false)
    expect(devEditorTokenMatches('', 'abc')).toBe(false)
    expect(devEditorTokenMatches(undefined, 'abc')).toBe(false)
  })
})

describe('dev editor session route', () => {
  it('keeps the production build guard on the handler', () => {
    const source = readFileSync(resolve(repoRoot(), 'apps/web-app/server/api/dev/editor-session.get.ts'), 'utf8')
    expect(source).toContain('import.meta.dev')
    expect(source).toContain('devEditorSessionAllowed')
    expect(source).toContain('readDevEditorToken')
    expect(source).toContain('statusCode: 404')
  })
})

describe('dev editor session cli', () => {
  it('refuses to run when NODE_ENV is production', () => {
    expect(() => execFileSync(process.execPath, [cli], {
      env: { ...process.env, NODE_ENV: 'production', DEV_EDITOR_SESSION: '1' },
      encoding: 'utf8',
    })).toThrow(/production/)
  })

  it('refuses to run without the flag', () => {
    expect(() => execFileSync(process.execPath, [cli], {
      env: { ...process.env, NODE_ENV: 'development', DEV_EDITOR_SESSION: '' },
      encoding: 'utf8',
    })).toThrow(/DEV_EDITOR_SESSION/)
  })
})
