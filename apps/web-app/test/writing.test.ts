import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTENT_GUIDE } from '../server/utils/mcp/guide'
import { writingGate } from '../server/utils/mcp/writing-guard'
import { VENUE_COPY_RULES, WRITING_BANNED_SITES, WRITING_STOP_LIST, WRITING_STOP_PATTERNS, writingGuideSection, writingHits } from '../shared/writing'

const skill = readFileSync(resolve(import.meta.dirname, '../../../.cursor/skills/k39-writing/SKILL.md'), 'utf8')

describe('writing stop-list', () => {
  it('content_guide prints the shared section', () => {
    expect(CONTENT_GUIDE).toContain(writingGuideSection())
  })

  it('the writing skill mirrors every phrase', () => {
    for (const item of [...WRITING_STOP_LIST, ...WRITING_STOP_PATTERNS, ...VENUE_COPY_RULES]) {
      expect(skill, item.phrase).toContain(item.phrase)
      expect(CONTENT_GUIDE, item.phrase).toContain(item.phrase)
    }
    for (const site of WRITING_BANNED_SITES) {
      expect(skill, site).toContain(site)
      expect(CONTENT_GUIDE, site).toContain(site)
    }
  })

  it('matches inflected forms and skips lookalike words', () => {
    for (const word of ['идеальный', 'идеальны', 'идеальное', 'идеальная', 'идеального', 'идеально', 'идеален', 'уникального', 'неповторимый', 'лучший']) {
      expect(writingHits(word).map((hit) => hit.phrase), word).toContain('empty superlatives')
    }
    for (const word of ['самый', 'самая', 'самое', 'самые', 'самого', 'самой', 'самому', 'самым', 'самыми', 'самую', 'самых', 'самом']) {
      expect(writingHits(`Это ${word} день.`).map((hit) => hit.phrase), word).toContain('empty superlatives')
    }
    for (const word of ['самовар', 'самолёт', 'самолет', 'самостоятельно', 'самодеятельность', 'самокат', 'сам', 'сама', 'само', 'сами', 'самим', 'самих', 'лучше', 'улучшить']) {
      expect(writingHits(word).map((hit) => hit.phrase), word).not.toContain('empty superlatives')
    }
    expect(writingHits('Он сам пришёл к самовару и поехал самостоятельно.').map((hit) => hit.phrase)).not.toContain('empty superlatives')
    expect(writingHits('лучше ехать утром').map((hit) => hit.phrase)).not.toContain('empty superlatives')
    expect(writingHits('Атмосферное место').map((hit) => hit.phrase)).toContain('атмосферн')
    expect(writingHits('тут атмосферно и гостеприимным залом').map((hit) => hit.phrase)).toEqual(expect.arrayContaining(['атмосферн', 'гостеприимн']))
    expect(writingHits('атмосфера зала').map((hit) => hit.phrase)).not.toContain('атмосферн')
    expect(writingHits('гостеприимство хозяина').map((hit) => hit.phrase)).not.toContain('гостеприимн')
    expect(writingHits('не оставит равнодушным').map((hit) => hit.phrase)).toContain('не оставит равнодушн')
    expect(writingHits('не оставят равнодушными').map((hit) => hit.phrase)).toContain('не оставит равнодушн')
    expect(writingHits('равнодушным тоном').map((hit) => hit.phrase)).not.toContain('не оставит равнодушн')
    expect(writingHits('окунулся в историю').map((hit) => hit.phrase)).toContain('окунуться')
    expect(writingHits('окунь на рынке').map((hit) => hit.phrase)).not.toContain('окунуться')
    expect(writingHits('меню порадует гостей').map((hit) => hit.phrase)).toContain('порадует')
    expect(writingHits('меню порадуют гостей').map((hit) => hit.phrase)).toContain('порадует')
    expect(writingHits('приятно удивят детей').map((hit) => hit.phrase)).toContain('приятно удивит')
    for (const item of WRITING_STOP_LIST) {
      expect(writingHits(item.phrase).map((hit) => hit.phrase), item.phrase).toContain(item.phrase)
    }
  })

  it('matches stems, intensifiers, evaluative triads, and the em dash', () => {
    expect(writingHits('Атмосферное место').map((hit) => hit.phrase)).toContain('атмосферн')
    expect(writingHits('настоящий борщ').map((hit) => hit.phrase)).toContain('настоящий')
    expect(writingHits('в настоящее время адрес указан').map((hit) => hit.phrase)).not.toContain('настоящий')
    expect(writingHits('настоящий адрес на табличке').map((hit) => hit.phrase)).not.toContain('настоящий')
    expect(writingHits('вкусно, душевно и атмосферно').map((hit) => hit.phrase)).toContain('triads')
    expect(writingHits('хлеб, молоко и сыр').map((hit) => hit.phrase)).not.toContain('triads')
    expect(writingHits('форт, замок и пляж').map((hit) => hit.phrase)).not.toContain('triads')
    expect(writingHits('Это не просто форт, а история.').map((hit) => hit.phrase)).toContain('не просто X, а Y')
    expect(writingHits('Форт — у дороги.').map((hit) => hit.phrase)).toContain('em dash')
    expect(writingHits('Форт - у дороги.').map((hit) => hit.phrase)).not.toContain('em dash')
    expect(writingHits('Капучино 250 ₽ и сырники 320 ₽')).toEqual([])
    expect(writingHits('Капучино 250 ₽ и сырники 320 ₽. Цены могли измениться.', { venue: true }).map((hit) => hit.phrase)).toEqual(expect.arrayContaining(['price retelling', 'price disclaimer']))
  })

  it('warns on a draft save and rejects a publish', () => {
    expect(writingGate('Форт у дороги.', false)).toEqual([])
    expect(writingGate('уютная атмосфера', false)).toEqual(['уютная атмосфера: уютная атмосфера'])
    expect(() => writingGate('уютная атмосфера', true)).toThrow(/Нельзя опубликовать/)
    for (const file of [
      'server/utils/mcp/places.ts',
      'server/utils/mcp/routes.ts',
      'server/utils/mcp/quests.ts',
      'server/utils/mcp/publish.ts',
      'server/mcp/tools/collection-save.ts',
      'server/mcp/tools/hub-update.ts',
      'server/utils/venues/write.ts',
    ]) {
      expect(readFileSync(resolve(import.meta.dirname, '..', file), 'utf8'), file).toContain('writingGate(')
    }
    try {
      writingGate('Форт — музей', true)
      expect.unreachable()
    } catch (error) {
      expect((error as { statusCode?: number }).statusCode).toBe(400)
    }
  })
})
