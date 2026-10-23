import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { closeSync, mkdtempSync, openSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'

// Only an explicitly isolated local database is accepted. Existing boot
// migrations/imports write it; no credentials or environment are printed.
const database = new URL(process.env.DATABASE_URL ?? '')
assert(['localhost', '127.0.0.1', '[::1]'].includes(database.hostname), 'Use a local benchmark database')
assert.equal(database.pathname, '/k39_a01', 'Use the dedicated k39_a01 database')
const port = 3457
const base = `http://127.0.0.1:${port}`
const directory = mkdtempSync(join(tmpdir(), 'k39-a01-start-'))
const results = []
const app = resolve('apps/web-app')
const require = createRequire(join(app, 'package.json'))
const entry = join(dirname(require.resolve('nuxt/package.json')), 'bin/nuxt.mjs')

async function freePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  await new Promise((resolve) => server.close(resolve))
}

async function start(phase) {
  await freePort()
  const logPath = join(directory, `${phase}.log`)
  const log = openSync(logPath, 'w', 0o600)
  const startedAt = new Date().toISOString()
  const started = performance.now()
  // Direct Node avoids a package-manager wrapper owning a second process group.
  // Nuxt's normal forked dev mode remains enabled.
  const child = spawn(process.execPath, [entry, 'dev', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: app,
    detached: true,
    stdio: ['ignore', log, log],
    env: { ...process.env, NODE_ENV: 'development', DEV_EDITOR_SESSION: '0', NUXT_TELEMETRY_DISABLED: '1', NUXT_SESSION_PASSWORD: 'isolated-agent-benchmark-session-password' },
  })
  let failed = false
  child.once('error', () => {
    failed = true
  })
  const closed = new Promise((resolve) => child.once('close', resolve))
  try {
    while (performance.now() - started < 180_000) {
      assert(!failed && child.exitCode === null && child.signalCode === null, `Dev process exited; inspect ${logPath}`)
      try {
        const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) })
        const article = health.ok ? await fetch(`${base}/fort-11-denhoff`, { signal: AbortSignal.timeout(5000) }) : null
        if (article?.ok && (await article.text()).includes('Форт')) {
          results.push({ phase, startedAt, readyAt: new Date().toISOString(), ms: Math.round(performance.now() - started), health: true, articleSsr: true })
          return
        }
      } catch {
        // A listening socket alone is not application readiness.
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`Dev readiness timed out; inspect ${logPath}`)
  } finally {
    const stop = (signal) => {
      if (child.pid) {
        try {
          process.kill(-child.pid, signal)
        } catch {}
      }
    }
    stop('SIGTERM')
    const deadline = setTimeout(() => stop('SIGKILL'), 5000)
    try {
      await closed
      let released = false
      for (let attempt = 0; attempt < 60; attempt++) {
        try {
          await freePort()
          released = true
          break
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }
      assert(released, 'Dev descendants did not release the benchmark port')
    } finally {
      clearTimeout(deadline)
      closeSync(log)
    }
  }
}

async function main() {
  await start('first')
  await start('warm')
  process.stdout.write(`A01_START_RESULT ${JSON.stringify({ node: process.version, results })}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
