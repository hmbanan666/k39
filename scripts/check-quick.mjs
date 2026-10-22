import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { extname } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const base = 'origin/main'

const LINT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.vue', '.md', '.json'])
const VITEST_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.vue'])
const TYPECHECK_ORDER = ['@k39/types', '@k39/map', '@k39/database', '@k39/web-app']

/**
 * What `check:quick` runs for a set of paths changed against `origin/main`.
 * Writer tests are excluded from the database `tsc` project, so they use the
 * web-app server typecheck instead. That project already runs when `apps/web-app` changed.
 * @param {string[]} files
 */
export function quickCheckPlan(files) {
  const filters = new Set()
  let writer = false
  for (const file of files) {
    if (file.startsWith('packages/database/') && file.endsWith('.writer.test.ts')) {
      writer = true
      continue
    }
    if (file.startsWith('apps/web-app/')) {
      filters.add('@k39/web-app')
    } else if (file.startsWith('packages/database/')) {
      filters.add('@k39/database')
    } else if (file.startsWith('packages/map/')) {
      filters.add('@k39/map')
    } else if (file.startsWith('packages/types/')) {
      filters.add('@k39/types')
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

function gitLines(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function changedFiles() {
  const listed = [
    ...gitLines(['diff', '--name-only', '--diff-filter=ACMR', base]),
    ...gitLines(['diff', '--name-only', '--cached', '--diff-filter=ACMR', base]),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ]
  return [...new Set(listed)].filter((file) => existsSync(file))
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
    execFileSync('git', ['rev-parse', '--verify', base], { cwd: root, stdio: 'ignore' })
  } catch {
    console.error(`check:quick: ${base} is missing`)
    process.exit(1)
  }

  run('pnpm', ['run', 'check:repo'])

  const plan = quickCheckPlan(changedFiles())
  if (!plan.lint.length && !plan.typecheck.length && !plan.writer && !plan.vitest.length) {
    console.log(`check:quick: no file changes against ${base}`)
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
