import { spawnSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

function pnpmVersion() {
  const result = spawnSync('pnpm', ['--version'], { encoding: 'utf8', timeout: 15_000 })
  return result.status === 0 ? result.stdout.trim() : null
}

/** Tool resolution only: no install, profile rewrite, database or image assumption. */
export function inspectToolchain({ root = process.cwd(), nodeVersion = process.version, probePnpm = pnpmVersion } = {}) {
  const expectedNode = readFileSync(resolve(root, '.nvmrc'), 'utf8').trim().replace(/^v/, '')
  const manager = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).packageManager
  const expectedPnpm = /^pnpm@(\d+\.\d+\.\d+)(?:\+.*)?$/.exec(manager ?? '')?.[1]
  if (!expectedPnpm) {
    throw new Error('package.json must pin an exact pnpm version')
  }
  const node = { expected: expectedNode, actual: nodeVersion.replace(/^v/, ''), executable: process.execPath }
  // Do not let a package-manager shim download or run under the wrong Node.
  if (node.actual !== node.expected) {
    return { ok: false, node, pnpm: { expected: expectedPnpm, actual: null, reason: 'not checked: select the pinned Node first' } }
  }
  const actual = probePnpm()
  return { ok: actual === expectedPnpm, node, pnpm: { expected: expectedPnpm, actual, reason: actual ? null : 'unavailable or version probe failed' } }
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(realpathSync(entry)).href) {
  try {
    const report = inspectToolchain()
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(report))
    } else {
      console.log(`node: ${report.node.actual} (want ${report.node.expected}) at ${report.node.executable}`)
      console.log(`pnpm: ${report.pnpm.actual ?? report.pnpm.reason} (want ${report.pnpm.expected})`)
      console.log(report.ok ? 'toolchain ready; database and application readiness are separate checks' : 'toolchain check failed; select project tools in this shell and retry')
    }
    process.exitCode = report.ok ? 0 : 1
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
