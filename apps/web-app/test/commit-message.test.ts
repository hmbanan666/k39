import { describe, expect, it } from 'vitest'
import { cleanCommitMessage } from '../../../scripts/git/clean-commit-message.mjs'

describe('portable commit message cleanup', () => {
  it('drops trailers with either capitalization and trims only trailing empty lines', () => {
    expect(cleanCommitMessage('fix: a change\r\n\r\nBody.\r\n\r\nCo-authored-by: Test <test@example.org>\r\nco-authored-by: Other <other@example.org>\r\n \r\n')).toBe('fix: a change\n\nBody.\n')
  })

  it('keeps an ordinary message and internal paragraph breaks', () => {
    expect(cleanCommitMessage('fix: a change\n\nFirst.\n\nSecond.\n')).toBe('fix: a change\n\nFirst.\n\nSecond.\n')
    expect(cleanCommitMessage('Co-authored-by: Test <test@example.org>\n')).toBe('')
  })
})
