// @vitest-environment node

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { acceptedBasemapUrl, fetchBasemapUrl } from '../app/lib/basemap-url'
import {
  BASEMAP_LOCK_STALE_MS,
  clientBasemapUrl,
  ensureBasemapArchive,
  normalizeSha256,
  resetBasemapArchiveState,
  resolveBasemapConfig,
  resolveBasemapUrl,
} from '../server/utils/basemap-archive'
import {
  BASEMAP_PUBLIC_PATH,
  DEFAULT_BASEMAP_SHA256,
  DEFAULT_BASEMAP_SOURCE_URL,
} from '../server/utils/basemap-defaults'

const quiet = { log() {} }

function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex')
}

function responseOf(bytes: Uint8Array, status = 200) {
  return new Response(bytes, { status })
}

describe('basemap url choice', () => {
  it('advertises the archive only when the hash matches', () => {
    expect(clientBasemapUrl(true)).toBe(BASEMAP_PUBLIC_PATH)
    expect(clientBasemapUrl(false)).toBe('')
    expect(clientBasemapUrl(false, '/basemap/kaliningrad.pmtiles')).toBe('')
    expect(clientBasemapUrl(true, 'https://storage.example/k39/kaliningrad.pmtiles')).toBe(
      'https://storage.example/k39/kaliningrad.pmtiles',
    )
  })

  it('keeps a failed lookup on OpenFreeMap', async () => {
    expect(acceptedBasemapUrl('/basemap/kaliningrad.pmtiles')).toBe('/basemap/kaliningrad.pmtiles')
    expect(acceptedBasemapUrl('//evil.example/map')).toBe('')
    expect(acceptedBasemapUrl('javascript:alert(1)')).toBe('')
    await expect(
      fetchBasemapUrl(async () => {
        throw new Error('offline')
      }),
    ).resolves.toBe('')
    await expect(fetchBasemapUrl(async () => ({ pmtilesUrl: '/basemap/kaliningrad.pmtiles' }))).resolves.toBe(
      '/basemap/kaliningrad.pmtiles',
    )
    await expect(fetchBasemapUrl(async () => ({ pmtilesUrl: '' }))).resolves.toBe('')
  })

  it('reads release defaults unless the env overrides them', () => {
    expect(normalizeSha256(`${DEFAULT_BASEMAP_SHA256.toUpperCase()}  kaliningrad.pmtiles`)).toBe(DEFAULT_BASEMAP_SHA256)
    expect(normalizeSha256('nope')).toBe('')
    const baked = resolveBasemapConfig({ env: {} })
    expect(baked.sha256).toBe(DEFAULT_BASEMAP_SHA256)
    expect(baked.sourceUrl).toBe(DEFAULT_BASEMAP_SOURCE_URL)
    expect(baked.file).toBe('/app/basemap/kaliningrad.pmtiles')
    const overridden = resolveBasemapConfig({
      sha256: DEFAULT_BASEMAP_SHA256,
      sourceUrl: DEFAULT_BASEMAP_SOURCE_URL,
      env: {
        BASEMAP_SHA256: 'a'.repeat(64),
        BASEMAP_SOURCE_URL: 'https://example.test/other.pmtiles',
        NUXT_BASEMAP_FILE: '/data/kaliningrad.pmtiles',
      },
    })
    expect(overridden.sha256).toBe('a'.repeat(64))
    expect(overridden.sourceUrl).toBe('https://example.test/other.pmtiles')
    expect(overridden.file).toBe('/data/kaliningrad.pmtiles')
    const nuxtName = resolveBasemapConfig({
      env: { NUXT_BASEMAP_SHA256: 'b'.repeat(64), NUXT_BASEMAP_SOURCE_URL: 'https://example.test/nuxt.pmtiles' },
    })
    expect(nuxtName.sha256).toBe('b'.repeat(64))
    expect(nuxtName.sourceUrl).toBe('https://example.test/nuxt.pmtiles')
  })

  it('bakes the same source and hash into the image', () => {
    const root = resolve(import.meta.dirname, '../../..')
    const dockerfile = readFileSync(resolve(root, 'docker/web-app/Dockerfile'), 'utf8')
    const nuxtConfig = readFileSync(resolve(root, 'apps/web-app/nuxt.config.ts'), 'utf8')
    expect(dockerfile).toContain(DEFAULT_BASEMAP_SHA256)
    expect(dockerfile).toContain(DEFAULT_BASEMAP_SOURCE_URL)
    expect(dockerfile).toContain('BASEMAP_SHA256=')
    expect(dockerfile).toContain('BASEMAP_SOURCE_URL=')
    expect(nuxtConfig).toContain('DEFAULT_BASEMAP_SHA256')
    expect(nuxtConfig).toContain('DEFAULT_BASEMAP_SOURCE_URL')
  })
})

describe('basemap archive fetch', () => {
  let dir = ''

  beforeEach(async () => {
    resetBasemapArchiveState()
    dir = await mkdtemp(join(tmpdir(), 'k39-basemap-'))
  })

  afterEach(async () => {
    resetBasemapArchiveState()
    await rm(dir, { recursive: true, force: true })
  })

  it('returns the public path only for a matching file', async () => {
    const bytes = Buffer.from('kaliningrad-ok')
    const file = join(dir, 'kaliningrad.pmtiles')
    await writeFile(file, bytes)
    const config = {
      file,
      sha256: sha256(bytes),
      sourceUrl: 'https://example.test/kaliningrad.pmtiles',
      configuredUrl: '',
    }
    await expect(resolveBasemapUrl(config)).resolves.toBe(BASEMAP_PUBLIC_PATH)
    await expect(resolveBasemapUrl({ ...config, sha256: sha256(Buffer.from('other')) })).resolves.toBe('')
    await expect(resolveBasemapUrl({ ...config, file: join(dir, 'missing.pmtiles') })).resolves.toBe('')
    await expect(
      resolveBasemapUrl({
        ...config,
        file: join(dir, 'missing.pmtiles'),
        configuredUrl: 'https://storage.example/map.pmtiles',
      }),
    ).resolves.toBe('https://storage.example/map.pmtiles')
  })

  it('leaves a matching file in place', async () => {
    const bytes = Buffer.from('already-here')
    const file = join(dir, 'kaliningrad.pmtiles')
    await writeFile(file, bytes)
    let calls = 0
    const result = await ensureBasemapArchive(
      {
        file,
        sha256: sha256(bytes),
        sourceUrl: 'https://example.test/kaliningrad.pmtiles',
        configuredUrl: '',
      },
      {
        ...quiet,
        fetch: async () => {
          calls += 1
          return responseOf(bytes)
        },
      },
    )
    expect(result.status).toBe('ready')
    expect(calls).toBe(0)
  })

  it('downloads a missing file, checks the hash, and renames it into place', async () => {
    const bytes = Buffer.from('fresh-archive')
    const file = join(dir, 'kaliningrad.pmtiles')
    const result = await ensureBasemapArchive(
      {
        file,
        sha256: sha256(bytes),
        sourceUrl: 'https://example.test/kaliningrad.pmtiles',
        configuredUrl: '',
      },
      {
        ...quiet,
        delays: [0],
        fetch: async () => responseOf(bytes),
      },
    )
    expect(result).toEqual({ status: 'downloaded' })
    await expect(readFile(file)).resolves.toEqual(bytes)
    await expect(
      stat(`${file}.partial`).then(
        () => true,
        () => false,
      ),
    ).resolves.toBe(false)
    await expect(
      stat(`${file}.lock`).then(
        () => true,
        () => false,
      ),
    ).resolves.toBe(false)
    await expect(
      resolveBasemapUrl({
        file,
        sha256: sha256(bytes),
        sourceUrl: 'https://example.test/kaliningrad.pmtiles',
        configuredUrl: '',
      }),
    ).resolves.toBe(BASEMAP_PUBLIC_PATH)
  })

  it('does not publish a download whose hash does not match', async () => {
    const bytes = Buffer.from('keep-me')
    const file = join(dir, 'kaliningrad.pmtiles')
    await writeFile(file, bytes)
    const result = await ensureBasemapArchive(
      {
        file,
        sha256: sha256(Buffer.from('expected')),
        sourceUrl: 'https://example.test/kaliningrad.pmtiles',
        configuredUrl: '',
      },
      {
        ...quiet,
        delays: [0],
        fetch: async () => responseOf(Buffer.from('wrong')),
      },
    )
    expect(result.status).toBe('failed')
    expect(result.reason).toContain('hash mismatch')
    await expect(readFile(file)).resolves.toEqual(bytes)
    await expect(
      stat(`${file}.partial`).then(
        () => true,
        () => false,
      ),
    ).resolves.toBe(false)
    await expect(
      resolveBasemapUrl({
        file,
        sha256: sha256(Buffer.from('expected')),
        sourceUrl: 'https://example.test/kaliningrad.pmtiles',
        configuredUrl: '',
      }),
    ).resolves.toBe('')
  })

  it('retries then replaces a mismatched file', async () => {
    const previous = Buffer.from('old')
    const next = Buffer.from('new')
    const file = join(dir, 'kaliningrad.pmtiles')
    await writeFile(file, previous)
    const waits: number[] = []
    let calls = 0
    const result = await ensureBasemapArchive(
      {
        file,
        sha256: sha256(next),
        sourceUrl: 'https://example.test/kaliningrad.pmtiles',
        configuredUrl: '',
      },
      {
        ...quiet,
        delays: [0, 25],
        sleep: async (ms) => {
          waits.push(ms)
        },
        fetch: async () => {
          calls += 1
          if (calls === 1) {
            return responseOf(new Uint8Array(), 500)
          }
          return responseOf(next)
        },
      },
    )
    expect(result.status).toBe('downloaded')
    expect(calls).toBe(2)
    expect(waits).toEqual([25])
    await expect(readFile(file)).resolves.toEqual(next)
  })

  it('runs one download when two callers start together', async () => {
    const bytes = Buffer.from('once')
    const file = join(dir, 'kaliningrad.pmtiles')
    let calls = 0
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate
    })
    const fetchImpl: typeof fetch = async () => {
      calls += 1
      await gate
      return responseOf(bytes)
    }
    const config = {
      file,
      sha256: sha256(bytes),
      sourceUrl: 'https://example.test/kaliningrad.pmtiles',
      configuredUrl: '',
    }
    const first = ensureBasemapArchive(config, { ...quiet, delays: [0], fetch: fetchImpl })
    const second = ensureBasemapArchive(config, { ...quiet, delays: [0], fetch: fetchImpl })
    release?.()
    const [a, b] = await Promise.all([first, second])
    expect(a.status).toBe('downloaded')
    expect(b.status).toBe('downloaded')
    expect(calls).toBe(1)
  })

  it('skips a fresh lock and takes over a stale one', async () => {
    const bytes = Buffer.from('after-stale')
    const file = join(dir, 'kaliningrad.pmtiles')
    const lock = `${file}.lock`
    await writeFile(lock, 'holder')
    const busy = await ensureBasemapArchive(
      {
        file,
        sha256: sha256(bytes),
        sourceUrl: 'https://example.test/kaliningrad.pmtiles',
        configuredUrl: '',
      },
      {
        ...quiet,
        fetch: async () => responseOf(bytes),
      },
    )
    expect(busy).toEqual({ status: 'busy' })
    await expect(
      stat(file).then(
        () => true,
        () => false,
      ),
    ).resolves.toBe(false)

    const stale = new Date(Date.now() - BASEMAP_LOCK_STALE_MS - 1000)
    await utimes(lock, stale, stale)
    const result = await ensureBasemapArchive(
      {
        file,
        sha256: sha256(bytes),
        sourceUrl: 'https://example.test/kaliningrad.pmtiles',
        configuredUrl: '',
      },
      {
        ...quiet,
        delays: [0],
        fetch: async () => responseOf(bytes),
      },
    )
    expect(result.status).toBe('downloaded')
    await expect(readFile(file)).resolves.toEqual(bytes)
  })

  it('skips the download for an external url or an empty hash', async () => {
    const file = join(dir, 'kaliningrad.pmtiles')
    let calls = 0
    const fetchImpl: typeof fetch = async () => {
      calls += 1
      return responseOf(Buffer.from('nope'))
    }
    const external = await ensureBasemapArchive(
      {
        file,
        sha256: 'c'.repeat(64),
        sourceUrl: 'https://example.test/kaliningrad.pmtiles',
        configuredUrl: 'https://storage.example/map.pmtiles',
      },
      { ...quiet, fetch: fetchImpl },
    )
    const missing = await ensureBasemapArchive(
      {
        file,
        sha256: '',
        sourceUrl: '',
        configuredUrl: '',
      },
      { ...quiet, fetch: fetchImpl },
    )
    expect(external).toEqual({ status: 'skipped', reason: 'external-url' })
    expect(missing).toEqual({ status: 'skipped', reason: 'missing-config' })
    expect(calls).toBe(0)
  })
})
