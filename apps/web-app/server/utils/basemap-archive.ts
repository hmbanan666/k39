import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, open, rename, stat, unlink, utimes } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import {
  BASEMAP_PUBLIC_PATH,
  DEFAULT_BASEMAP_FILE,
  DEFAULT_BASEMAP_SHA256,
  DEFAULT_BASEMAP_SOURCE_URL,
} from './basemap-defaults'

export const BASEMAP_DOWNLOAD_DELAYS_MS = [0, 5_000, 20_000, 60_000, 180_000]

export const BASEMAP_LOCK_STALE_MS = 30 * 60 * 1000

const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000

export interface BasemapConfig {
  file: string
  sha256: string
  sourceUrl: string
  configuredUrl: string
}

export interface BasemapConfigInput {
  file?: string
  sha256?: string
  sourceUrl?: string
  configuredUrl?: string
  env?: Record<string, string | undefined>
}

export type BasemapEnsureStatus = 'ready' | 'downloaded' | 'busy' | 'skipped' | 'failed'

export interface BasemapEnsureResult {
  status: BasemapEnsureStatus
  reason?: string
}

export interface BasemapEnsureOptions {
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  delays?: number[]
  lockStaleMs?: number
  timeoutMs?: number
  log?: (level: 'info' | 'error', message: string) => void
}

interface VerifiedArchive {
  size: number
  mtimeMs: number
  expected: string
  ok: boolean
}

const verified = new Map<string, VerifiedArchive>()
const hashing = new Map<string, Promise<boolean>>()
let flight: Promise<BasemapEnsureResult> | null = null

export function resetBasemapArchiveState() {
  verified.clear()
  hashing.clear()
  flight = null
}

export function normalizeSha256(value: string) {
  const token = value.trim().toLowerCase().split(/\s+/)[0] || ''
  return /^[0-9a-f]{64}$/.test(token) ? token : ''
}

function firstDefined(...values: Array<string | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) {
      return trimmed
    }
  }
  return ''
}

export function resolveBasemapConfig(input: BasemapConfigInput = {}): BasemapConfig {
  const env = input.env ?? process.env
  return {
    file: firstDefined(env.NUXT_BASEMAP_FILE, input.file, DEFAULT_BASEMAP_FILE),
    sha256: firstDefined(env.BASEMAP_SHA256, env.NUXT_BASEMAP_SHA256, input.sha256, DEFAULT_BASEMAP_SHA256),
    sourceUrl: firstDefined(
      env.BASEMAP_SOURCE_URL,
      env.NUXT_BASEMAP_SOURCE_URL,
      input.sourceUrl,
      DEFAULT_BASEMAP_SOURCE_URL,
    ),
    configuredUrl: input.configuredUrl?.trim() || '',
  }
}

export function basemapConfigFromRuntime(): BasemapConfig {
  const config = useRuntimeConfig()
  return resolveBasemapConfig({
    file: typeof config.basemapFile === 'string' ? config.basemapFile : '',
    sha256: typeof config.basemapSha256 === 'string' ? config.basemapSha256 : '',
    sourceUrl: typeof config.basemapSourceUrl === 'string' ? config.basemapSourceUrl : '',
    configuredUrl: typeof config.public?.pmtilesUrl === 'string' ? config.public.pmtilesUrl : '',
  })
}

export function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim())
}

// Empty string is the OpenFreeMap style. A same-origin path is advertised only after the hash matches.
export function clientBasemapUrl(matches: boolean, configuredUrl = '') {
  const configured = configuredUrl.trim()
  if (isHttpUrl(configured)) {
    return configured
  }
  return matches ? BASEMAP_PUBLIC_PATH : ''
}

export async function resolveBasemapUrl(config: BasemapConfig) {
  if (isHttpUrl(config.configuredUrl)) {
    return config.configuredUrl.trim()
  }
  return clientBasemapUrl(await archiveMatches(config.file, config.sha256))
}

export function ensureBasemapArchive(config: BasemapConfig, options: BasemapEnsureOptions = {}) {
  if (flight) {
    return flight
  }
  flight = runEnsure(config, options).finally(() => {
    flight = null
  })
  return flight
}

async function runEnsure(config: BasemapConfig, options: BasemapEnsureOptions): Promise<BasemapEnsureResult> {
  if (isHttpUrl(config.configuredUrl)) {
    note(options, 'info', 'skip download, external url')
    return { status: 'skipped', reason: 'external-url' }
  }
  const expected = normalizeSha256(config.sha256)
  if (!expected || !isHttpUrl(config.sourceUrl)) {
    note(options, 'info', 'skip download, source or hash is empty')
    return { status: 'skipped', reason: 'missing-config' }
  }
  if (await archiveMatches(config.file, expected)) {
    note(options, 'info', `ready ${config.file}`)
    return { status: 'ready' }
  }

  const lockPath = `${config.file}.lock`
  let acquired = false
  try {
    const lock = await tryAcquire(lockPath, options.lockStaleMs ?? BASEMAP_LOCK_STALE_MS)
    if (lock === 'busy') {
      note(options, 'info', `download in progress ${lockPath}`)
      return { status: 'busy' }
    }
    acquired = true
    if (await archiveMatches(config.file, expected)) {
      note(options, 'info', `ready ${config.file}`)
      return { status: 'ready' }
    }
    return await downloadWithRetries(config, expected, options, lockPath)
  } catch (error) {
    const reason = errorText(error)
    note(options, 'error', reason)
    return { status: 'failed', reason }
  } finally {
    if (acquired) {
      await unlink(lockPath).catch(() => {})
    }
  }
}

async function downloadWithRetries(
  config: BasemapConfig,
  expected: string,
  options: BasemapEnsureOptions,
  lockPath: string,
): Promise<BasemapEnsureResult> {
  const delays = options.delays ?? BASEMAP_DOWNLOAD_DELAYS_MS
  let last = 'download failed'
  for (let attempt = 0; attempt < delays.length; attempt++) {
    const wait = delays[attempt] ?? 0
    if (wait > 0) {
      await (options.sleep ?? delay)(wait)
    }
    await utimes(lockPath, new Date(), new Date()).catch(() => {})
    try {
      await writeVerifiedArchive(config, expected, options)
      verified.delete(config.file)
      note(options, 'info', `downloaded ${config.file}`)
      return { status: 'downloaded' }
    } catch (error) {
      last = errorText(error)
      note(options, 'error', `attempt ${attempt + 1} failed: ${last}`)
    }
  }
  note(options, 'error', `giving up: ${last}`)
  return { status: 'failed', reason: last }
}

async function writeVerifiedArchive(config: BasemapConfig, expected: string, options: BasemapEnsureOptions) {
  const partial = `${config.file}.partial`
  await mkdir(dirname(config.file), { recursive: true })
  try {
    const digest = await streamDownload(config.sourceUrl, partial, options)
    if (digest !== expected) {
      throw new Error(`hash mismatch ${digest}`)
    }
    const handle = await open(partial, 'r+')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(partial, config.file)
  } catch (error) {
    await unlink(partial).catch(() => {})
    throw error
  }
}

async function streamDownload(url: string, dest: string, options: BasemapEnsureOptions) {
  const fetchImpl = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? DOWNLOAD_TIMEOUT_MS
  const controller = new AbortController()
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null
  timer?.unref?.()
  try {
    const response = await fetchImpl(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'k39-basemap' },
      signal: controller.signal,
    })
    if (!response.ok) {
      await response.body?.cancel().catch(() => {})
      throw new Error(`download ${response.status}`)
    }
    if (!response.body) {
      throw new Error('download had no body')
    }
    const hash = createHash('sha256')
    await pipeline(
      Readable.fromWeb(response.body as unknown as WebReadableStream<Uint8Array>),
      new Transform({
        transform(chunk, _encoding, callback) {
          hash.update(chunk)
          callback(null, chunk)
        },
      }),
      createWriteStream(dest),
    )
    return hash.digest('hex')
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

async function archiveMatches(file: string, expectedRaw: string) {
  const expected = normalizeSha256(expectedRaw)
  if (!expected) {
    return false
  }
  const key = `${file}\0${expected}`
  const pending = hashing.get(key)
  if (pending) {
    return pending
  }
  const run = archiveMatchesOnce(file, expected).finally(() => {
    if (hashing.get(key) === run) {
      hashing.delete(key)
    }
  })
  hashing.set(key, run)
  return run
}

async function archiveMatchesOnce(file: string, expected: string) {
  let info: { size: number; mtimeMs: number; isFile: () => boolean }
  try {
    info = await stat(file)
  } catch {
    return false
  }
  if (!info.isFile()) {
    return false
  }
  const cached = verified.get(file)
  if (cached && cached.size === info.size && cached.mtimeMs === info.mtimeMs && cached.expected === expected) {
    return cached.ok
  }
  let digest = ''
  try {
    digest = await sha256File(file)
  } catch {
    return false
  }
  const ok = digest === expected
  verified.set(file, { size: info.size, mtimeMs: info.mtimeMs, expected, ok })
  return ok
}

async function sha256File(file: string) {
  const hash = createHash('sha256')
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(file)
    stream.on('data', (chunk) => {
      hash.update(chunk)
    })
    stream.on('error', reject)
    stream.on('end', () => resolve())
  })
  return hash.digest('hex')
}

async function tryAcquire(lockPath: string, staleMs: number): Promise<'acquired' | 'busy'> {
  await mkdir(dirname(lockPath), { recursive: true })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await open(lockPath, 'wx')
      try {
        await handle.writeFile(`${process.pid} ${Date.now()}\n`)
      } finally {
        await handle.close()
      }
      return 'acquired'
    } catch (error) {
      if (!isErrno(error, 'EEXIST')) {
        throw error
      }
      const info = await stat(lockPath).catch(() => null)
      if (!info) {
        continue
      }
      if (Date.now() - info.mtimeMs < staleMs) {
        return 'busy'
      }
      await unlink(lockPath).catch(() => {})
    }
  }
  return 'busy'
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    timer.unref?.()
  })
}

function note(options: BasemapEnsureOptions, level: 'info' | 'error', message: string) {
  if (options.log) {
    options.log(level, message)
    return
  }
  if (level === 'error') {
    console.error('basemap', message)
    return
  }
  console.warn('basemap', message)
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isErrno(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}
