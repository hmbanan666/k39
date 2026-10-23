import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

// Run only in a disposable clone at the A01 merge, with a local test database.
const baseline = '349a2c6359b40887940a807353115c10feefe402'
const helper = resolve(process.argv[2])
assert.notEqual(process.cwd(), helper)
const database = new URL(process.env.DATABASE_URL_TEST)
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname))
assert.ok(database.pathname.endsWith('_test'))

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: { ...process.env, K39_CHECK_TIMINGS: '1' },
    maxBuffer: 32 * 1024 * 1024,
  })
  assert.ifError(result.error)
  return { exit: result.status, output: result.stdout + result.stderr }
}

assert.equal(run('git', ['rev-parse', 'HEAD']).output.trim(), baseline)
assert.equal(run('git', ['status', '--porcelain']).output.trim(), '')
const contract = 'packages/types/src/freshness.ts'
const fixture = 'apps/web-app/shared/a02-format-probe.ts'
const originalContract = readFileSync(contract, 'utf8')
const originalPackage = readFileSync('package.json', 'utf8')
assert.ok(!existsSync(fixture))
try {
  const signature = 'export function priceFreshCutoff(now = new Date()) {'
  assert.ok(originalContract.includes(signature))
  writeFileSync(contract, originalContract.replace(signature, 'export function priceFreshCutoff(now = new Date()): string | null {'))
  const old = run('pnpm', ['run', 'check:quick'])
  console.warn(old.output)
  assert.equal(old.exit, 0, 'Baseline quick must pass the actual contract mutation')
  assert.ok(old.output.includes('typecheck @k39/types'))
  assert.ok(!old.output.includes('typecheck @k39/database'))
  const current = run(process.execPath, [resolve(helper, 'scripts/check-quick.mjs')])
  console.warn(current.output)
  assert.notEqual(current.exit, 0)
  assert.match(current.output, /repository\/prices\.ts.*error TS(?:18047|2769)/)
  assert.match(current.output, /"step":"typecheck @k39\/database".*"exitCode":[1-9]/)
  console.warn(`A02_CONTRACT_RESULT ${JSON.stringify({ baseline, oldExit: old.exit, newExit: current.exit, consumerDiagnostic: true })}`)

  writeFileSync(contract, originalContract)
  writeFileSync('package.json', readFileSync(resolve(helper, 'package.json')))
  const unformatted = 'export const a02FormattingProbe = "probe";\n'
  writeFileSync(fixture, unformatted)
  const full = run('pnpm', ['run', 'check:full'])
  console.warn(full.output)
  assert.notEqual(full.exit, 0)
  assert.match(full.output, /a02-format-probe\.ts/)
  assert.match(full.output, /(?:quotes|semi)/)
  assert.equal(readFileSync(fixture, 'utf8'), unformatted)
  const fix = run('pnpm', ['run', 'lint:fix'])
  console.warn(fix.output)
  assert.equal(fix.exit, 0)
  assert.notEqual(readFileSync(fixture, 'utf8'), unformatted)
  console.warn(`A02_FORMAT_RESULT ${JSON.stringify({ fullExit: full.exit, sourceUnchanged: true, fixExit: fix.exit, explicitFixChangedSource: true })}`)
} finally {
  writeFileSync(contract, originalContract)
  writeFileSync('package.json', originalPackage)
  rmSync(fixture, { force: true })
}
assert.equal(run('git', ['status', '--porcelain']).output.trim(), '')
