import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { closeSync, mkdtempSync, openSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
  const child = spawn('pnpm', ['--filter', '@k39/web-app', 'exec', 'nuxt', 'dev', '--host', '127.0.0.1', '--port', String(port)], {
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
    await closed
    clearTimeout(deadline)
    closeSync(log)
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
