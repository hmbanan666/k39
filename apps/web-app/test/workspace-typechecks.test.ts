import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dependentTypechecks, workspacePackages } from '../../../scripts/workspace-typechecks.mjs'

describe('workspace typecheck graph', () => {
  it('reads globs, exclusions and dependency kinds without requiring a typecheck on every intermediary', () => {
    const root = mkdtempSync(join(tmpdir(), 'k39-workspaces-'))
    try {
      writeFileSync(
        join(root, 'pnpm-workspace.yaml'),
        'packages:\n  - packages/*\n  - apps/*\n  - "!packages/ignored"\n',
      )
      const manifests = [
        ['packages/core', { name: 'core', scripts: { typecheck: 'tsc' } }],
        ['packages/bridge', { name: 'bridge', dependencies: { core: 'workspace:*' } }],
        ['apps/client', { name: 'client', scripts: { typecheck: 'tsc' }, devDependencies: { bridge: 'workspace:*' } }],
        ['apps/peer', { name: 'peer', scripts: { typecheck: 'tsc' }, peerDependencies: { client: '*' } }],
        ['apps/optional', { name: 'optional', scripts: { typecheck: 'tsc' }, optionalDependencies: { core: '*' } }],
        ['packages/unrelated', { name: 'unrelated', scripts: { typecheck: 'tsc' }, dependencies: { external: '1' } }],
        ['packages/ignored', { name: 'ignored', scripts: { typecheck: 'tsc' } }],
      ] as const
      for (const [dir, manifest] of manifests) {
        mkdirSync(join(root, dir), { recursive: true })
        writeFileSync(join(root, dir, 'package.json'), JSON.stringify(manifest))
      }
      const packages = workspacePackages(root)
      expect(packages.map((item) => item.name)).not.toContain('ignored')
      expect(dependentTypechecks(packages, ['core'])).toEqual(['core', 'client', 'optional', 'peer'])
      expect(dependentTypechecks(packages, ['unrelated'])).toEqual(['unrelated'])
      expect(dependentTypechecks(packages, [], true)).toContain('unrelated')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('terminates on dependency cycles and includes each consumer once', () => {
    const packages = [
      { name: 'a', typecheck: true, dependencies: ['b'] },
      { name: 'b', typecheck: true, dependencies: ['a'] },
    ]
    expect(dependentTypechecks(packages, ['a'])).toEqual(['b', 'a'])
  })
})
