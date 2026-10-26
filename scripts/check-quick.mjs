import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { dependentTypechecks, workspacePackages } from './workspace-typechecks.mjs'
import { isWriterTest } from './writer-tests.mjs'

const root = process.cwd()
const baseRef = 'origin/main'

const LINT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.vue'])
const FORMAT_EXTENSIONS = new Set([...LINT_EXTENSIONS, '.md', '.json', '.jsonc', '.yaml', '.yml', '.css', '.html'])
const VITEST_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.vue'])
const scriptRoot = resolve(import.meta.dirname, '..')

/**
 * What `check:quick` runs for paths changed against the merge-base.
 * `deleted` paths only choose packages to typecheck. Writer tests are excluded
 * from the database `tsc` project, so any `packages/database/` change also
 * runs the web-app server typecheck unless that package is already selected.
 * Source changes include transitive consumers from workspace manifests.
 * Root configuration or an unresolvable removed package checks every package.
 * @param {string[]} files paths that still exist
 * @param {string[]} [deleted] paths removed against the base
 */
export function quickCheckPlan(files, deleted = [], packages = workspacePackages(scriptRoot)) {
  const filters = new Set()
  let writer = false
  let allPackages = false
  for (const file of [...files, ...deleted]) {
    if (isRootTypecheckConfig(file)) {
      allPackages = true
    }
    const owner = packages
      .filter((item) => file.startsWith(`${item.dir}/`))
      .sort((a, b) => b.dir.length - a.dir.length)[0]
    if (!owner && /^(?:packages|apps)\//.test(file)) {
      allPackages = true
    }
    if (file.startsWith('packages/database/')) {
      writer = true
    }
    if (owner && !isWriterTest(file)) {
      filters.add(owner.name)
    }
  }
  const typecheck = dependentTypechecks(packages, filters, allPackages)
  if (typecheck.includes('@k39/web-app')) {
    writer = false
  }
  return {
    all: allPackages,
    format: files.filter((file) => FORMAT_EXTENSIONS.has(extname(file))),
    vue: files.filter((file) => extname(file) === '.vue'),
    lint: files.filter((file) => LINT_EXTENSIONS.has(extname(file))),
    typecheck,
    writer,
    vitest: files.filter((file) => VITEST_EXTENSIONS.has(extname(file))),
  }
}

function isRootTypecheckConfig(file) {
  if (file.includes('/') || file.includes('\\')) {
    return false
  }
  return (
    file === 'package.json' ||
    file === 'pnpm-lock.yaml' ||
    file === 'pnpm-workspace.yaml' ||
    file.startsWith('tsconfig') ||
    file.startsWith('vite.config.') ||
    file.startsWith('vitest.config.') ||
    file.startsWith('eslint.config.')
  )
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

function run(command, args, step) {
  const started = performance.now()
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (process.env.K39_CHECK_TIMINGS === '1') {
    console.log(
      `check:quick: timing ${JSON.stringify({ step, ms: Math.round(performance.now() - started), exitCode: result.status ?? 1 })}`,
    )
  }
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
  run('corepack', ['pnpm', 'run', 'check:repo'], 'repo')

  const { files, deleted } = changedFiles(baseSha)
  const plan = quickCheckPlan(files, deleted, workspacePackages(root))
  if (!plan.format.length && !plan.lint.length && !plan.typecheck.length && !plan.writer && !plan.vitest.length) {
    console.log(`check:quick: no file changes against ${baseSha}`)
    process.exit(0)
  }

  console.log(
    `check:quick: format ${plan.format.length}, lint ${plan.lint.length}, Vue templates ${plan.vue.length}, typecheck ${plan.typecheck.join(', ') || 'none'}${plan.writer ? ' + writer tests' : ''}, vitest ${plan.vitest.length}`,
  )

  if (plan.all || plan.format.length) {
    run('corepack', ['pnpm', 'exec', 'vp', 'fmt', '--check', ...(plan.all ? ['.'] : plan.format)], 'format')
  }
  if (plan.all || plan.lint.length) {
    run('corepack', ['pnpm', 'exec', 'vp', 'lint', ...(plan.all ? ['.'] : plan.lint)], 'lint')
  }
  if (plan.all || plan.vue.length) {
    run(
      'corepack',
      ['pnpm', 'exec', 'eslint', '--no-warn-ignored', ...(plan.all ? ['apps/web-app'] : plan.vue)],
      'Vue templates',
    )
  }
  for (const name of plan.typecheck) {
    run('corepack', ['pnpm', '--filter', name, 'typecheck'], `typecheck ${name}`)
  }
  if (plan.writer) {
    run('node', ['scripts/typecheck-writer.mjs'], 'writer typecheck')
  }
  if (plan.all) {
    run('corepack', ['pnpm', 'run', 'test'], 'tests')
  } else if (plan.vitest.length) {
    run('corepack', ['pnpm', 'exec', 'vp', 'test', 'related', '--run', '--passWithNoTests', ...plan.vitest], 'tests')
  }
  console.log('check:quick passed')
}
