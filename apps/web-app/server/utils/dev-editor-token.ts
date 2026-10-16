import { Buffer } from 'node:buffer'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

/** Local file the dev server writes. Same uid can read it. A remote client cannot. */
export function devEditorTokenPath() {
  return join(tmpdir(), `k39-dev-editor-token-${process.getuid?.() ?? 'user'}`)
}

export function writeDevEditorToken() {
  const token = randomBytes(32).toString('hex')
  writeFileSync(devEditorTokenPath(), `${token}\n`, { mode: 0o600 })
  return token
}

export function readDevEditorToken() {
  try {
    return readFileSync(devEditorTokenPath(), 'utf8').trim()
  } catch {
    return ''
  }
}

export function devEditorTokenMatches(presented: string | undefined, expected: string | undefined) {
  if (!presented || !expected) {
    return false
  }
  const left = Buffer.from(presented)
  const right = Buffer.from(expected)
  if (left.length !== right.length) {
    return false
  }
  return timingSafeEqual(left, right)
}
