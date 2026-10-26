import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { inspectToolchain } from '../../../scripts/env/check-toolchain.mjs'

const roots: string[] = []
function fixture(manager = 'pnpm@12.15.0') {
  const root = mkdtempSync(join(tmpdir(), 'k39-toolchain-'))
  roots.push(root)
  writeFileSync(join(root, '.nvmrc'), '24.21.0\n')
  writeFileSync(join(root, 'package.json'), JSON.stringify({ packageManager: manager }))
  return root
}
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })))

describe('portable toolchain check', () => {
  it('accepts the exact project pins without a host image profile', () => {
    expect(inspectToolchain({ root: fixture(), nodeVersion: 'v24.21.0', probePnpm: () => '12.15.0' }).ok).toBe(true)
  })
  it('probes pinned Corepack pnpm even when an incompatible host pnpm is first on PATH', () => {
    const dir = mkdtempSync(join(tmpdir(), 'k39-host-pnpm-'))
    roots.push(dir)
    writeFileSync(join(dir, 'pnpm'), '#!/bin/sh\necho 10.24.0\n', { mode: 0o755 })
    const root = resolve(import.meta.dirname, '../../..')
    const result = spawnSync(process.execPath, ['scripts/env/check-toolchain.mjs', '--json'], {
      cwd: root,
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
      encoding: 'utf8',
      timeout: 20_000,
    })
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, pnpm: { actual: '12.15.0' } })
  })
  it('fails before invoking a package-manager shim under the wrong Node', () => {
    const probePnpm = vi.fn(() => '12.15.0')
    const report = inspectToolchain({ root: fixture(), nodeVersion: 'v24.19.0', probePnpm })
    expect(report.ok).toBe(false)
    expect(report.node).toMatchObject({ expected: '24.21.0', actual: '24.19.0' })
    expect(probePnpm).not.toHaveBeenCalled()
  })
  it.each(['11.0.0', null])('rejects an incorrect or unavailable pnpm: %s', (version) => {
    expect(inspectToolchain({ root: fixture(), nodeVersion: '24.21.0', probePnpm: () => version }).ok).toBe(false)
  })
  it('reads the exact version from a Corepack integrity pin', () => {
    expect(
      inspectToolchain({
        root: fixture('pnpm@12.15.0+sha512.test'),
        nodeVersion: '24.21.0',
        probePnpm: () => '12.15.0',
      }).ok,
    ).toBe(true)
  })
  it('refuses an ambiguous package-manager pin', () => {
    expect(() => inspectToolchain({ root: fixture('pnpm@latest') })).toThrow('exact pnpm version')
  })
})
