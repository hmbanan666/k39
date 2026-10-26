import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { journalOrderErrors } from '../../../scripts/check-repo.mjs'

function repoRoot() {
  const candidates = [process.cwd(), resolve(process.cwd(), '../..')]
  return candidates.find((dir) => existsSync(resolve(dir, 'pnpm-workspace.yaml'))) ?? process.cwd()
}

function row(idx: number, when: number, tag: string) {
  return { idx, when, tag, version: '7', breakpoints: true }
}

function messages(entries: unknown) {
  return journalOrderErrors({ entries })
}

describe('migration journal order', () => {
  it('accepts idx 0..n-1 with a strictly later when and tag prefix', () => {
    expect(messages([row(0, 10, '0000_first'), row(1, 11, '0001_second'), row(2, 20, '0003_gap')])).toEqual([])
  })

  it('accepts the committed journal', () => {
    const journal = JSON.parse(
      readFileSync(resolve(repoRoot(), 'packages/database/migrations/meta/_journal.json'), 'utf8'),
    )
    expect(journalOrderErrors(journal)).toEqual([])
  })

  it('names both entries when an idx is shared', () => {
    const errors = messages([row(0, 10, '0000_first'), row(0, 11, '0001_second')])
    expect(
      errors.some(
        (message) => message.includes('idx 0') && message.includes('0000_first') && message.includes('0001_second'),
      ),
    ).toBe(true)
  })

  it('names both entries when idx is not 0..n-1 in file order', () => {
    const errors = messages([row(0, 10, '0000_first'), row(2, 12, '0002_third')])
    expect(
      errors.some(
        (message) => message.includes('0002_third') && message.includes('0000_first') && message.includes('0..1'),
      ),
    ).toBe(true)
  })

  it('names both entries when when is equal or lower', () => {
    const equal = messages([row(0, 10, '0000_first'), row(1, 10, '0001_second')])
    expect(
      equal.some(
        (message) => message.includes('0001_second') && message.includes('0000_first') && message.includes('when 10'),
      ),
    ).toBe(true)

    const lower = messages([row(0, 10, '0000_first'), row(1, 9, '0001_second')])
    expect(
      lower.some(
        (message) => message.includes('0001_second') && message.includes('0000_first') && message.includes('when 9'),
      ),
    ).toBe(true)
  })

  it('names both entries when the tag prefix does not increase with idx', () => {
    const reversed = messages([row(0, 10, '0001_later'), row(1, 11, '0000_earlier')])
    expect(
      reversed.some(
        (message) => message.includes('0000_earlier') && message.includes('0001_later') && message.includes('prefix'),
      ),
    ).toBe(true)

    const equal = messages([row(0, 10, '0004_one'), row(1, 11, '0004_two')])
    expect(
      equal.some(
        (message) => message.includes('0004_one') && message.includes('0004_two') && message.includes('prefix'),
      ),
    ).toBe(true)
  })

  it('rejects a journal that is not a list of entries', () => {
    expect(journalOrderErrors({})).toEqual(['migration journal entries is not an array'])
    expect(journalOrderErrors(null)).toEqual(['migration journal entries is not an array'])
  })
})
