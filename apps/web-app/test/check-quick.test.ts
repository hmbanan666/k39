import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { quickCheckPlan } from '../../../scripts/check-quick.mjs'

describe('quick timing failure contract', () => {
  it.each(['1', ''])('preserves a failing child exit code with timings %j', (timings) => {
    const root = mkdtempSync(join(tmpdir(), 'k39-quick-timing-'))
    const bin = join(root, 'bin')
    mkdirSync(bin)
    // The first repo-check child fails, before file selection is reached.
    writeFileSync(join(bin, 'git'), '#!/bin/sh\necho 0123456789012345678901234567890123456789\n', { mode: 0o755 })
    writeFileSync(join(bin, 'pnpm'), '#!/bin/sh\nexit 99\n', { mode: 0o755 })
    writeFileSync(join(bin, 'corepack'), '#!/bin/sh\n[ "$1" = pnpm ] || exit 98\nexit 23\n', { mode: 0o755 })
    const script = resolve(import.meta.dirname, '../../../scripts/check-quick.mjs')
    try {
      const result = spawnSync(process.execPath, [script], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, K39_CHECK_TIMINGS: timings },
      })
      expect(result.status).toBe(23)
      const line = result.stdout.split('\n').find((line) => line.startsWith('check:quick: timing '))
      if (timings) {
        expect(JSON.parse(line!.slice('check:quick: timing '.length))).toMatchObject({ step: 'repo', exitCode: 23 })
      } else {
        expect(line).toBeUndefined()
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('check:quick plan', () => {
  it('includes changed packages and their transitive consumers', () => {
    const plan = quickCheckPlan(['packages/types/src/index.ts', 'packages/map/src/index.ts', 'AGENTS.md'])
    expect(plan.typecheck).toEqual(['@k39/types', '@k39/database', '@k39/map', '@k39/web-app'])
    expect(plan.writer).toBe(false)
    expect(plan.lint).toEqual(['packages/types/src/index.ts', 'packages/map/src/index.ts'])
    expect(plan.format).toEqual(['packages/types/src/index.ts', 'packages/map/src/index.ts', 'AGENTS.md'])
    expect(plan.vitest).toEqual(['packages/types/src/index.ts', 'packages/map/src/index.ts'])
  })

  it('routes Vue semantics and data-file formatting to their own stages', () => {
    const plan = quickCheckPlan(['apps/web-app/app/pages/index.vue', 'pnpm-workspace.yaml', 'styles.css'])
    expect(plan.lint).toEqual(['apps/web-app/app/pages/index.vue'])
    expect(plan.vue).toEqual(['apps/web-app/app/pages/index.vue'])
    expect(plan.format).toEqual(['apps/web-app/app/pages/index.vue', 'pnpm-workspace.yaml', 'styles.css'])
  })

  it('sends writer tests to the web-app server project, not database tsc', () => {
    const plan = quickCheckPlan(['packages/database/src/repository/test/pending-publish.writer.test.ts'])
    expect(plan.typecheck).toEqual([])
    expect(plan.writer).toBe(true)
    expect(plan.lint).toEqual(['packages/database/src/repository/test/pending-publish.writer.test.ts'])
    expect(plan.vitest).toEqual(['packages/database/src/repository/test/pending-publish.writer.test.ts'])
  })

  it('typechecks writer tests when any database file changes', () => {
    const plan = quickCheckPlan(['packages/database/src/prices.ts'])
    expect(plan.typecheck).toEqual(['@k39/database', '@k39/web-app'])
    expect(plan.writer).toBe(false)
    expect(plan.vitest).toEqual(['packages/database/src/prices.ts'])
  })

  it('typechecks the package of a deleted file and does not lint or test it', () => {
    const only = quickCheckPlan([], ['packages/database/src/old.ts'])
    expect(only.typecheck).toEqual(['@k39/database', '@k39/web-app'])
    expect(only.writer).toBe(false)
    expect(only.lint).toEqual([])
    expect(only.vitest).toEqual([])

    const mixed = quickCheckPlan(
      ['packages/map/src/index.ts'],
      ['packages/database/src/old.ts', 'apps/web-app/app/missing.vue'],
    )
    expect(mixed.typecheck).toEqual(['@k39/database', '@k39/map', '@k39/web-app'])
    expect(mixed.writer).toBe(false)
    expect(mixed.lint).toEqual(['packages/map/src/index.ts'])
    expect(mixed.vitest).toEqual(['packages/map/src/index.ts'])
  })

  it('typechecks every package when a root config changes', () => {
    for (const file of [
      'tsconfig.json',
      'vite.config.ts',
      'vitest.config.mts',
      'eslint.config.mjs',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
    ]) {
      const plan = quickCheckPlan([file])
      expect(plan.typecheck, file).toEqual(['@k39/types', '@k39/database', '@k39/map', '@k39/web-app'])
      expect(plan.writer, file).toBe(false)
      expect(plan.all, file).toBe(true)
    }
    const nested = quickCheckPlan(['packages/database/package.json'])
    expect(nested.typecheck).toEqual(['@k39/database', '@k39/web-app'])
    expect(nested.writer).toBe(false)
  })

  it('lets the web-app typecheck cover writer tests when that package also changed', () => {
    const plan = quickCheckPlan([
      'apps/web-app/shared/page-modules.ts',
      'packages/database/src/repository/test/pending-publish.writer.test.ts',
    ])
    expect(plan.typecheck).toEqual(['@k39/web-app'])
    expect(plan.writer).toBe(false)
  })

  it('checks a types-only contract change through the database into the web-app', () => {
    expect(quickCheckPlan(['packages/types/src/freshness.ts']).typecheck).toEqual([
      '@k39/types',
      '@k39/database',
      '@k39/web-app',
    ])
    expect(quickCheckPlan(['packages/map/src/index.ts']).typecheck).toEqual(['@k39/map', '@k39/web-app'])
  })

  it('falls back to all workspaces when a removed package cannot be resolved', () => {
    expect(quickCheckPlan([], ['packages/removed/src/index.ts']).typecheck).toEqual([
      '@k39/types',
      '@k39/database',
      '@k39/map',
      '@k39/web-app',
    ])
  })

  it('does nothing but repo checks when only untyped files changed', () => {
    const plan = quickCheckPlan(['docs/adr/README.md'])
    expect(plan.typecheck).toEqual([])
    expect(plan.writer).toBe(false)
    expect(plan.vitest).toEqual([])
    expect(plan.lint).toEqual([])
    expect(plan.format).toEqual(['docs/adr/README.md'])
  })
})
