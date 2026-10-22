import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { extname } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { isWriterTest } from './writer-tests.mjs'

const root = process.cwd()
const baseRef = 'origin/main'

const LINT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.vue', '.md', '.json'])
const VITEST_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.vue'])
const TYPECHECK_ORDER = ['@k39/types', '@k39/map', '@k39/database', '@k39/web-app']

/**
 * What `check:quick` runs for paths changed against the merge-base.
 * `deleted` paths only choose packages to typecheck. Writer tests are excluded
 * from the database `tsc` project, so any `packages/database/` change also
 * runs the web-app server typecheck unless that package is already selected.
 * A root config change typechecks every package.
 * @param {string[]} files paths that still exist
 * @param {string[]} [deleted] paths removed against the base
 */
export function quickCheckPlan(files, deleted = []) {
  const filters = new Set()
  let writer = false
  let allPackages = false
  for (const file of [...files, ...deleted]) {
    if (isRootTypecheckConfig(file)) {
      allPackages = true
    }
    if (file.startsWith('packages/database/')) {
      writer = true
      if (!isWriterTest(file)) {
        filters.add('@k39/database')
      }
    } else if (file.startsWith('apps/web-app/')) {
      filters.add('@k39/web-app')
    } else if (file.startsWith('packages/map/')) {
      filters.add('@k39/map')
    } else if (file.startsWith('packages/types/')) {
      filters.add('@k39/types')
    }
  }
  if (allPackages) {
    for (const name of TYPECHECK_ORDER) {
      filters.add(name)
    }
  }
  if (filters.has('@k39/web-app')) {
    writer = false
  }
  return {
    lint: files.filter((file) => LINT_EXTENSIONS.has(extname(file))),
    typecheck: TYPECHECK_ORDER.filter((name) => filters.has(name)),
    writer,
    vitest: files.filter((file) => VITEST_EXTENSIONS.has(extname(file))),
  }
}

function isRootTypecheckConfig(file) {
  if (file.includes('/') || file.includes('\\')) {
    return false
  }
  return file === 'package.json'
    || file === 'pnpm-lock.yaml'
    || file.startsWith('tsconfig')
    || file.startsWith('vitest.config.')
    || file.startsWith('eslint.config.')
}

function gitLines(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function diffBase() {
  return execFileSync('git', ['merge-base', baseRef, 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
}

function changedFiles(baseSha) {
  const present = [
    ...gitLines(['diff', '--name-only', '--diff-filter=ACMR', baseSha]),
    ...gitLines(['diff', '--name-only', '--cached', '--diff-filter=ACMR', baseSha]),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ]
  const removed = [
    ...gitLines(['diff', '--name-only', '--diff-filter=D', baseSha]),
    ...gitLines(['diff', '--name-only', '--cached', '--diff-filter=D', baseSha]),
  ]
  return {
    files: [...new Set(present)].filter((file) => existsSync(file)),
    deleted: [...new Set(removed)].filter((file) => !existsSync(file)),
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) {
    return false
  }
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href
  } catch {
    return false
  }
}

if (isDirectRun()) {
  try {
    execFileSync('git', ['rev-parse', '--verify', baseRef], { cwd: root, stdio: 'ignore' })
  } catch {
    console.error(`check:quick: ${baseRef} is missing`)
    process.exit(1)
  }

  const baseSha = diffBase()
  console.log(`check:quick: base ${baseSha}`)
  run('pnpm', ['run', 'check:repo'])

  const { files, deleted } = changedFiles(baseSha)
  const plan = quickCheckPlan(files, deleted)
  if (!plan.lint.length && !plan.typecheck.length && !plan.writer && !plan.vitest.length) {
    console.log(`check:quick: no file changes against ${baseSha}`)
    process.exit(0)
  }

  console.log(`check:quick: eslint ${plan.lint.length}, typecheck ${plan.typecheck.join(', ') || 'none'}${plan.writer ? ' + writer tests' : ''}, vitest ${plan.vitest.length}`)

  if (plan.lint.length) {
    run('pnpm', ['exec', 'eslint', ...plan.lint])
  }
  for (const name of plan.typecheck) {
    run('pnpm', ['--filter', name, 'typecheck'])
  }
  if (plan.writer) {
    run('node', ['scripts/typecheck-writer.mjs'])
  }
  if (plan.vitest.length) {
    run('pnpm', ['exec', 'vitest', 'related', '--run', '--passWithNoTests', ...plan.vitest])
  }
  console.log('check:quick passed')
}
