import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTENT_GUIDE } from '../server/utils/mcp/guide'
import { writingGate } from '../server/utils/mcp/writing-guard'
import { VENUE_COPY_RULES, WRITING_BANNED_SITES, WRITING_STOP_LIST, WRITING_STOP_PATTERNS, writingGuideSection, writingHits } from '../shared/writing'

const skill = readFileSync(resolve(import.meta.dirname, '../../../.agents/skills/k39-writing/SKILL.md'), 'utf8')

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
    for (const word of ['самый', 'самая', 'самое', 'самые', 'самым', 'самыми', 'самую', 'самых']) {
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

  it.each([
    'Что посмотреть в самом Нестерове?', 'У самого моря.', 'К самому берегу.', 'В самом центре.',
    'В самой кирхе.', 'У самой воды.', 'От самой границы.', 'Самого себя.', 'Самому себе.',
    'САМ Нестеров стоит у реки.', 'Самомнение не помогает.',
    'В **самом** Нестерове.', 'У _самого_ моря.',
  ])('allows emphatic pronouns without an evaluative adjective: %s', (text) => {
    expect(writingHits(text)).toEqual([])
    expect(writingGate({ prose: text, publishing: false })).toEqual([])
    expect(writingGate({ prose: text, publishing: true })).toEqual([])
  })

  it.each([
    'В самом красивом городе.', 'У самого высокого берега.', 'К самому древнему храму.',
    'В самой высокой башне.', 'От самой дальней границы.', 'Самою красивою улицей.',
    'В САМОМ КРАСИВОМ городе.', 'В самом северо-западном городе.',
    'У самого **высокого** берега.', 'В самом _красивом_ городе.',
    'В **самом** красивом городе.', 'В самом **очень красивом** городе.',
    'В самом **очень** _красивом_ городе.',
    'У самого действительно высокого берега.', 'В самой необычно красивой башне.',
    'В самом Нестерове есть самый высокий дом.',
    'У самого моря, в самом красивом городе.',
    'В самом Нестерове, в самой красивой башне.',
  ])('still warns and blocks a real superlative: %s', (text) => {
    expect(writingHits(text).map((hit) => hit.phrase)).toContain('empty superlatives')
    expect(writingGate({ prose: text, publishing: false })).not.toEqual([])
    expect(() => writingGate({ prose: text, publishing: true })).toThrow(/Нельзя опубликовать/)
  })

  it('keeps independent phrase bans after pronoun disambiguation', () => {
    expect(writingHits('В самом сердце города.').map((hit) => hit.phrase)).toContain('в самом сердце')
    expect(() => writingGate({ prose: 'В самом Нестерове уютная атмосфера.', publishing: true })).toThrow(/уютная атмосфера/)
  })

  it.each(['ой', 'ою'].flatMap((ending) => [
    { adjective: 'высок', noun: 'башней', forms: ['ой', 'ою'] },
    { adjective: 'красив', noun: 'улицей', forms: ['ой', 'ою'] },
    { adjective: 'дальн', noun: 'границей', forms: ['ей', 'ею'] },
  ].flatMap(({ adjective, noun, forms }) => forms.map((form) => ({
    sam: `сам${ending}`, adjective: `${adjective}${form}`, noun,
  })))))('warns and blocks feminine instrumental variants: $sam $adjective $noun', ({ sam, adjective, noun }) => {
    for (const prose of [
      `Город гордится ${sam} ${adjective} ${noun}.`,
      `Город гордится **${sam}** _${adjective}_ ${noun}.`,
      `Город гордится ${sam} действительно **${adjective}** ${noun}.`,
    ]) {
      expect(writingHits(prose).map((hit) => hit.phrase), prose).toContain('empty superlatives')
      expect(writingGate({ prose, publishing: false }), prose).not.toEqual([])
      expect(() => writingGate({ prose, publishing: true }), prose).toThrow(/Нельзя опубликовать/)
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
    expect(writingGate({ prose: 'Форт у дороги.', publishing: false })).toEqual([])
    expect(writingGate({ prose: 'уютная атмосфера', publishing: false })).toEqual(['уютная атмосфера: уютная атмосфера'])
    expect(() => writingGate({ prose: 'уютная атмосфера', publishing: true })).toThrow(/Нельзя опубликовать/)
    expect(readFileSync(resolve(import.meta.dirname, '../server/utils/content/save.ts'), 'utf8')).toContain('writingGate(')
    try {
      writingGate({ prose: 'Форт — музей', publishing: true })
      expect.unreachable()
    } catch (error) {
      expect((error as { statusCode?: number }).statusCode).toBe(400)
    }
  })
})
