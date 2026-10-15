/**
 * Banned Russian copy. `writingGuideSection()` is what `content_guide` prints.
 * `.cursor/skills/k39-writing/SKILL.md` must contain every `phrase`.
 * `apps/web-app/test/writing.test.ts` fails when the two diverge.
 */

export interface WritingStop {
  /** Exact fragment the guide and the writing skill both contain. */
  phrase: string
  /** Short English note printed by the guide. */
  note: string
}

export const WRITING_STOP_LIST = [
  { phrase: 'уютная атмосфера', note: 'Names a mood. Name the room, the hour, or the dish.' },
  { phrase: 'идеальное место', note: 'A slogan. Say who stops and for what.' },
  { phrase: 'каждый найдёт', note: 'Also the spelling without ё: «каждый найдет».' },
  { phrase: 'гастрономическое путешествие', note: 'Menu-speak. Name the dish and the price.' },
  { phrase: 'настоящий', note: 'Empty intensifier, as in «настоящий борщ» or «настоящая история».' },
] as const satisfies readonly WritingStop[]

export const WRITING_STOP_PATTERNS = [
  { phrase: 'empty superlatives', note: 'лучший, самый, уникальный, неповторимый, незабываемый, идеальный, with no measured fact.' },
  { phrase: 'triads', note: 'Three adjectives or three nouns in a row, such as «вкусно, душевно и атмосферно».' },
  { phrase: 'не просто X, а Y', note: 'The contrast cliché. Write the fact.' },
  { phrase: 'em dash', note: 'The character — in body copy, UI chrome, or the HTML title. Use a period, a comma, a colon, or parentheses.' },
] as const satisfies readonly WritingStop[]

/** Sites we do not name, link, or use as a source. */
export const WRITING_BANNED_SITES = ['kgdmore.ru'] as const

export function writingGuideSection() {
  const phrases = WRITING_STOP_LIST.map((item) => `- «${item.phrase}»: ${item.note}`).join('\n')
  const patterns = WRITING_STOP_PATTERNS.map((item) => `- ${item.phrase}: ${item.note}`).join('\n')
  const sites = WRITING_BANNED_SITES.join(', ')
  return [
    'Tone: plain, specific, calm. Concrete facts, not adjectives. No slogans and no invented atmosphere.',
    '',
    'Stop-list. Source of truth: apps/web-app/shared/writing.ts (WRITING_STOP_LIST, WRITING_STOP_PATTERNS, WRITING_BANNED_SITES). content_guide prints this section. .cursor/skills/k39-writing/SKILL.md repeats every phrase. apps/web-app/test/writing.test.ts fails if a phrase is missing from either place. Do not add a ban in only one file.',
    phrases,
    'Patterns:',
    patterns,
    `Never name ${sites}. Never paste another site's sentences. Write from the sources, in our words.`,
    'Length, page shape, and FAQ: .cursor/skills/k39-writing/SKILL.md.',
  ].join('\n')
}
