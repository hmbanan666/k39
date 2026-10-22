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
      'packages/database/src/prices.ts',
    ])
    expect(plan.typecheck).toEqual(['@k39/database'])
    expect(plan.writer).toBe(true)
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
