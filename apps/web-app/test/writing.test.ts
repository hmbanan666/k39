import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTENT_GUIDE } from '../server/utils/mcp/guide'
import { WRITING_BANNED_SITES, WRITING_STOP_LIST, WRITING_STOP_PATTERNS, writingGuideSection } from '../shared/writing'

const skill = readFileSync(resolve(import.meta.dirname, '../../../.cursor/skills/k39-writing/SKILL.md'), 'utf8')

describe('writing stop-list', () => {
  it('content_guide prints the shared section', () => {
    expect(CONTENT_GUIDE).toContain(writingGuideSection())
  })

  it('the writing skill mirrors every phrase', () => {
    for (const item of [...WRITING_STOP_LIST, ...WRITING_STOP_PATTERNS]) {
      expect(skill, item.phrase).toContain(item.phrase)
      expect(CONTENT_GUIDE, item.phrase).toContain(item.phrase)
    }
    for (const site of WRITING_BANNED_SITES) {
      expect(skill, site).toContain(site)
      expect(CONTENT_GUIDE, site).toContain(site)
    }
  })
})
