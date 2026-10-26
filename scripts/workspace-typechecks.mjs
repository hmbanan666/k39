import { globSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parse } from 'yaml'

/** Read the same workspace globs and local dependency names as the manifests. */
export function workspacePackages(root) {
  const config = parse(readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8'))
  const patterns = config.packages ?? []
  const manifests = globSync(
    patterns.filter((value) => !value.startsWith('!')).map((value) => `${value}/package.json`),
    {
      cwd: root,
      exclude: [
        '**/node_modules/**',
        ...patterns.filter((value) => value.startsWith('!')).map((value) => `${value.slice(1)}/**`),
      ],
    },
  )
  const packages = manifests.map((file) => {
    const manifest = JSON.parse(readFileSync(resolve(root, file), 'utf8'))
    return {
      name: manifest.name,
      dir: dirname(file).replaceAll('\\', '/'),
      typecheck: Boolean(manifest.scripts?.typecheck),
      dependencies: Object.keys({
        ...manifest.dependencies,
        ...manifest.devDependencies,
        ...manifest.peerDependencies,
        ...manifest.optionalDependencies,
      }),
    }
  })
  const names = new Set(packages.map((item) => item.name))
  if (names.has(undefined) || names.size !== packages.length) {
    throw new Error('Workspace packages must have unique names for typecheck selection')
  }
  return packages.map((item) => ({ ...item, dependencies: item.dependencies.filter((name) => names.has(name)) }))
}

/** A changed contract reaches consumers even through a package without a script. */
export function dependentTypechecks(packages, changed, all = false) {
  const selected = new Set(all ? packages.map((item) => item.name) : changed)
  let added = true
  while (added) {
    added = false
    for (const item of packages) {
      if (!selected.has(item.name) && item.dependencies.some((name) => selected.has(name))) {
        selected.add(item.name)
        added = true
      }
    }
  }
  const byName = new Map(packages.map((item) => [item.name, item]))
  const visited = new Set()
  const ordered = []
  const visit = (name) => {
    if (visited.has(name) || !selected.has(name)) {
      return
    }
    visited.add(name)
    const item = byName.get(name)
    for (const dependency of [...item.dependencies].sort()) {
      visit(dependency)
    }
    if (item.typecheck) {
      ordered.push(name)
    }
  }
  for (const name of [...selected].sort()) {
    visit(name)
  }
  return ordered
}
