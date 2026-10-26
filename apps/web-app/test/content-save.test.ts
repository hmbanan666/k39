import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contentWarnings } from '../server/utils/content/save'

const ROOT = resolve(import.meta.dirname, '..')
const HOOK = 'server/utils/content/save.ts'

const WRITES = [
  '.savePlace(',
  '.saveRoute(',
  '.saveCollection(',
  '.saveQuest(',
  '.saveCategory(',
  '.saveContentDraft(',
  '.applyPendingPlace(',
  '.venues.create(',
  '.venues.update(',
  '.upsertPassport(',
]

function files(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      files(path, out)
    } else if (name.endsWith('.ts')) {
      out.push(path)
    }
  }
  return out
}

describe('content save hook', () => {
  it('normalizes whitespace before the stop-list and rejects a publish', () => {
    expect(contentWarnings({ prose: ['уютная   атмосфера'], publishing: false })).toEqual([
      'уютная атмосфера: уютная атмосфера',
    ])
    expect(contentWarnings({ prose: ['Форт у дороги.'], publishing: true })).toEqual([])
    expect(() => contentWarnings({ prose: ['Форт — музей'], publishing: true })).toThrow(/Нельзя опубликовать/)
  })

  it('is the only server module that writes a content table', () => {
    const offenders: string[] = []
    for (const file of files(join(ROOT, 'server'))) {
      const rel = file.slice(ROOT.length + 1)
      if (rel === HOOK) {
        continue
      }
      const source = readFileSync(file, 'utf8')
      for (const call of WRITES) {
        if (source.includes(call)) {
          offenders.push(`${rel} ${call}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
