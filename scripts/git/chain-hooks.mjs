import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/** Git only runs hook names that exist in core.hooksPath. The cloud set has no post-commit, so the trailer would stay. */
export function linkMissingHooks(huskyDir, dispatcherDir) {
  const linked = []
  for (const name of readdirSync(huskyDir)) {
    if (name.startsWith('.') || name.startsWith('_')) {
      continue
    }
    const source = join(huskyDir, name)
    if (!lstatSync(source).isFile()) {
      continue
    }
    const dest = join(dispatcherDir, name)
    if (existsSync(dest)) {
      continue
    }
    symlinkSync('.dispatcher', dest)
    linked.push(name)
  }
  return linked
}

export function findDispatcher(home, workspace, currentHooksPath) {
  const encoded = Buffer.from(workspace).toString('base64').replace(/=+$/g, '')
  const preferred = join(home, '.cursor', 'agent-hooks', encoded)
  const candidates = [preferred]
  if (currentHooksPath) {
    candidates.push(currentHooksPath)
  }
  const base = join(home, '.cursor', 'agent-hooks')
  if (existsSync(base)) {
    for (const name of readdirSync(base)) {
      candidates.push(join(base, name))
    }
  }
  const seen = new Set()
  for (const dir of candidates) {
    if (!dir || seen.has(dir)) {
      continue
    }
    seen.add(dir)
    if (existsSync(join(dir, '.dispatcher'))) {
      return dir
    }
  }
  return null
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function main() {
  let root
  try {
    root = git(['rev-parse', '--show-toplevel'])
  } catch {
    process.exit(0)
  }

  const huskyDir = join(root, '.husky')
  if (!existsSync(join(huskyDir, 'pre-commit'))) {
    process.exit(0)
  }

  let current = ''
  try {
    current = git(['config', '--get', 'core.hooksPath'])
  } catch {
    current = ''
  }

  const dispatcher = findDispatcher(homedir(), root, current)
  if (!dispatcher) {
    process.exit(0)
  }

  writeFileSync(join(dispatcher, '.cursor-original-hooks-path'), `${huskyDir}\n`)
  const linked = linkMissingHooks(huskyDir, dispatcher)
  git(['config', 'core.hooksPath', dispatcher])
  const extra = linked.length ? ` (linked ${linked.join(', ')})` : ''
  console.log(`husky hooks chained from ${dispatcher}${extra}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
