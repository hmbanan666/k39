import { describe, expect, it } from 'vitest'
import { BODY_LINE_MAX, bodyWrapResult } from '../../../scripts/git/commitlint-body.mjs'

describe('commitlint body wrap', () => {
  it('accepts an empty body and a line at the limit', () => {
    expect(bodyWrapResult(undefined)).toEqual([true])
    expect(bodyWrapResult('')).toEqual([true])
    expect(bodyWrapResult('a'.repeat(BODY_LINE_MAX))).toEqual([true])
  })

  it('names the long line and tells the author how to wrap', () => {
    const body = `short\n${'b'.repeat(BODY_LINE_MAX + 1)}`
    const result = bodyWrapResult(body)
    expect(result[0]).toBe(false)
    expect(result[1]).toContain('body line 2 is 101 characters')
    expect(result[1]).toContain('Wrap the body')
    expect(result[1]).toContain('lint-staged')
    expect(result[1]).toContain('feat: short subject')
  })
})
