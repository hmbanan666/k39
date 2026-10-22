import { describe, expect, it } from 'vitest'
import { quickCheckPlan } from '../../../scripts/check-quick.mjs'

describe('check:quick plan', () => {
  it('typechecks only the packages that changed', () => {
    const plan = quickCheckPlan([
      'packages/types/src/index.ts',
      'packages/map/src/index.ts',
      'AGENTS.md',
    ])
    expect(plan.typecheck).toEqual(['@k39/types', '@k39/map'])
    expect(plan.writer).toBe(false)
    expect(plan.lint).toEqual([
      'packages/types/src/index.ts',
      'packages/map/src/index.ts',
      'AGENTS.md',
    ])
    expect(plan.vitest).toEqual([
      'packages/types/src/index.ts',
      'packages/map/src/index.ts',
    ])
  })

  it('sends writer tests to the web-app server project, not database tsc', () => {
    const plan = quickCheckPlan([
      'packages/database/src/repository/test/pending-publish.writer.test.ts',
    ])
    expect(plan.typecheck).toEqual([])
    expect(plan.writer).toBe(true)
    expect(plan.lint).toEqual(['packages/database/src/repository/test/pending-publish.writer.test.ts'])
    expect(plan.vitest).toEqual(['packages/database/src/repository/test/pending-publish.writer.test.ts'])
  })

  it('typechecks writer tests when any database file changes', () => {
    const plan = quickCheckPlan(['packages/database/src/prices.ts'])
    expect(plan.typecheck).toEqual(['@k39/database'])
    expect(plan.writer).toBe(true)
    expect(plan.vitest).toEqual(['packages/database/src/prices.ts'])
  })

  it('typechecks the package of a deleted file and does not lint or test it', () => {
    const only = quickCheckPlan([], ['packages/database/src/old.ts'])
    expect(only.typecheck).toEqual(['@k39/database'])
    expect(only.writer).toBe(true)
    expect(only.lint).toEqual([])
    expect(only.vitest).toEqual([])

    const mixed = quickCheckPlan(['packages/map/src/index.ts'], ['packages/database/src/old.ts', 'apps/web-app/app/missing.vue'])
    expect(mixed.typecheck).toEqual(['@k39/map', '@k39/database', '@k39/web-app'])
    expect(mixed.writer).toBe(false)
    expect(mixed.lint).toEqual(['packages/map/src/index.ts'])
    expect(mixed.vitest).toEqual(['packages/map/src/index.ts'])
  })

  it('typechecks every package when a root config changes', () => {
    for (const file of ['tsconfig.json', 'vitest.config.mts', 'eslint.config.mjs', 'package.json', 'pnpm-lock.yaml']) {
      const plan = quickCheckPlan([file])
      expect(plan.typecheck, file).toEqual(['@k39/types', '@k39/map', '@k39/database', '@k39/web-app'])
      expect(plan.writer, file).toBe(false)
    }
    const nested = quickCheckPlan(['packages/database/package.json'])
    expect(nested.typecheck).toEqual(['@k39/database'])
    expect(nested.writer).toBe(true)
  })

  it('lets the web-app typecheck cover writer tests when that package also changed', () => {
    const plan = quickCheckPlan([
      'apps/web-app/shared/page-modules.ts',
      'packages/database/src/repository/test/pending-publish.writer.test.ts',
    ])
    expect(plan.typecheck).toEqual(['@k39/web-app'])
    expect(plan.writer).toBe(false)
  })

  it('does nothing but repo checks when only untyped files changed', () => {
    const plan = quickCheckPlan(['docs/adr/README.md'])
    expect(plan.typecheck).toEqual([])
    expect(plan.writer).toBe(false)
    expect(plan.vitest).toEqual([])
    expect(plan.lint).toEqual(['docs/adr/README.md'])
  })
})
