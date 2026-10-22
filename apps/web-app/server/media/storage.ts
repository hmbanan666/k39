import type { Buffer } from 'node:buffer'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, normalize, resolve, sep } from 'node:path'
import process from 'node:process'

export interface MediaStorage {
  put: (key: string, body: Buffer) => Promise<void>
  get: (key: string) => Promise<Buffer | null>
  delete: (key: string) => Promise<void>
  exists: (key: string) => Promise<boolean>
}

export function mediaRoot() {
  return process.env.MEDIA_DIR || (process.env.NODE_ENV === 'production' ? '/app/media' : resolve('.data/media'))
}

export function resolveMediaKey(root: string, key: string) {
  if (!key || key.includes('\0') || key.split('/').some((part) => part === '..' || part === '')) {
    throw new Error('Unsafe media key')
  }
  const full = resolve(root, normalize(key))
  const base = resolve(root)
  if (full !== base && !full.startsWith(`${base}${sep}`)) {
    throw new Error('Unsafe media key')
  }
  return full
}

export function createLocalMediaStorage(root = mediaRoot()): MediaStorage {
  return {
    async put(key, body) {
      const path = resolveMediaKey(root, key)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, body)
    },
    async get(key) {
      try {
        return await readFile(resolveMediaKey(root, key))
      } catch {
        return null
      }
    },
    async delete(key) {
      await rm(resolveMediaKey(root, key), { force: true })
    },
    async exists(key) {
      try {
        await stat(resolveMediaKey(root, key))
        return true
      } catch {
        return false
      }
    },
  }
}
