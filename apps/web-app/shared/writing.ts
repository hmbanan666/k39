/**
 * Banned Russian copy. `writingGuideSection()` is what `content_guide` prints.
 * `.cursor/skills/k39-writing/SKILL.md` must contain every `phrase`.
 * `apps/web-app/test/writing.test.ts` fails when the two diverge.
 * Saves call `writingHits`. A draft keeps the row and returns the hits.
 * Publishing throws.
 */

export interface WritingStop {
  /** Text the guide and the writing skill must contain. */
  phrase: string
  /** Short English note printed by the guide. */
  note: string
  /** Set on pattern rows. Phrase rows match the phrase itself. */
  pattern?: RegExp
}

export interface WritingHit {
  phrase: string
  /** The text that matched. */
  match: string
}

/** Brochure adjectives. A triad of these is banned. A neutral list is not. */
const EVALUATIVE_STEMS = [
  'уютн',
  'вкусн',
  'атмосферн',
  'душевн',
  'прекрасн',
  'красив',
  'незабываем',
  'идеальн',
  'потрясающ',
  'волшебн',
  'гостеприимн',
  'аутентичн',
  'восхитительн',
  'чудесн',
  'сказочн',
  'комфортн',
  'романтичн',
] as const

const EVALUATIVE_WORD = `(?:${EVALUATIVE_STEMS.map((stem) => `${stem}\\p{L}*`).join('|')})`

export const WRITING_STOP_LIST = [
  { phrase: 'уютная атмосфера', note: 'Names a mood. Name the room, the hour, or the dish.' },
  { phrase: 'идеальное место', note: 'A slogan. Say who stops and for what.' },
  { phrase: 'каждый найдёт', note: 'The spelling with ё.' },
  { phrase: 'каждый найдет', note: 'The same slogan without ё.' },
  { phrase: 'гастрономическое путешествие', note: 'Menu-speak. Name the dish and the price in the price block, not in prose.' },
  { phrase: 'в самом сердце', note: 'A location slogan. Name the street or the district.' },
  { phrase: 'порадует', note: 'A promise. State the fact.' },
  { phrase: 'приятно удивит', note: 'A promise. State the fact.' },
  { phrase: 'на любой вкус', note: 'Empty range. Name who it is for only from a source.' },
  { phrase: 'по-домашнему', note: 'A mood. Name the dish or the room.' },
  { phrase: 'атмосферн', note: 'Stem: атмосферный, атмосферно, and the rest.' },
  { phrase: 'гостеприимн', note: 'Stem: гостеприимный and the rest.' },
  { phrase: 'отличный выбор', note: 'A verdict with no fact.' },
  { phrase: 'стоит посетить', note: 'A slogan. Say what the visitor does there.' },
  { phrase: 'не оставит равнодушн', note: 'Stem: равнодушным, равнодушными.' },
  { phrase: 'окунуться', note: 'Brochure verb. Name the action.' },
  { phrase: 'для ценителей', note: 'A fake audience.' },
  { phrase: 'вкусно и недорого', note: 'A slogan. The price block carries the prices.' },
] as const satisfies readonly WritingStop[]

export const WRITING_STOP_PATTERNS = [
  {
    phrase: 'empty superlatives',
    note: 'лучший, самый, уникальный, неповторимый, незабываемый, идеальный, and the same words with other endings.',
    pattern: /(?<!\p{L})(?:лучш(?:ий|ая|ее|ие)|сам(?:ый|ая|ое|ые)|уникальн(?:ый|ая|ое|ые|о)|неповторим(?:ый|ая|ое|ые|о)|незабываем(?:ый|ая|ое|ые|о)|идеальн(?:ый|ая|ое|ые|о))(?!\p{L})/iu,
  },
  {
    phrase: 'настоящий',
    note: 'Intensifier only: настоящий, настоящая, настоящее, настоящие before a noun. Not «в настоящее время», «настоящий адрес», «настоящее имя», «настоящий номер», «настоящий документ».',
    pattern: /(?<!\p{L})настоящ(?:ий|ая|ее|ие)(?=\s+(?!(?:время|имя|адрес|номер|документ|размер|вес|состав)(?!\p{L}))\p{L})/iu,
  },
  {
    phrase: 'triads',
    note: 'Three evaluative adjectives, such as «вкусно, душевно и атмосферно». A neutral list («хлеб, молоко и сыр», «форт, замок и пляж») is allowed.',
    pattern: new RegExp(`${EVALUATIVE_WORD}(?:\\s*,\\s*${EVALUATIVE_WORD})+\\s+и\\s+${EVALUATIVE_WORD}|${EVALUATIVE_WORD}(?:\\s*,\\s*${EVALUATIVE_WORD}){2,}`, 'iu'),
  },
  {
    phrase: 'не просто X, а Y',
    note: 'The contrast cliché. Write the fact.',
    pattern: /не\s+просто\s+\S+(?:\s+\S+){0,6}(?:\s+(?:,\s+)?|,\s+)а\s+\S+/iu,
  },
  {
    phrase: 'em dash',
    note: 'U+2014 in body copy, UI chrome, or the HTML title. Use a period, a comma, a colon, or parentheses.',
    pattern: /\u2014/,
  },
] as const satisfies readonly WritingStop[]

/**
 * Venue prose only. Prices stay in «Ориентиры цен» and «Что заказать».
 * The price grid already prints the source line, including «Цены могли измениться».
 */
export const VENUE_COPY_RULES = [
  {
    phrase: 'price retelling',
    note: 'Two or more ruble amounts in venue prose. Do not retell the price list.',
    pattern: /\d[\d\s]{0,8}\s*₽[\s\S]{0,160}\d[\d\s]{0,8}\s*₽/u,
  },
  {
    phrase: 'price disclaimer',
    note: 'No disclaimer about price anchors or packaged juice. Do not write «Цены могли измениться», «ориентиры цен», or «сок из пакета» in the description.',
    pattern: /цены\s+могли\s+измениться|ориентир\p{L}*\s+цен|не\s+явля\p{L}*\s+(?:полным\s+)?меню|сок\s+из\s+пакет|из\s+бутылк|упакованн\p{L}*\s+сок|не\s+из\s+пакет/iu,
  },
] as const satisfies readonly WritingStop[]

/** Sites we do not name, link, or use as a source. */
export const WRITING_BANNED_SITES = ['kgdmore.ru'] as const

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchRule(text: string, rule: WritingStop) {
  const pattern = rule.pattern ?? new RegExp(escapeRegExp(rule.phrase), 'iu')
  const found = text.match(pattern)
  return found?.[0] ?? null
}

/** Stop-list, pattern, and (for a venue) price-copy hits. One hit per rule. */
export function writingHits(text: string, options?: { venue?: boolean }): WritingHit[] {
  const rules: readonly WritingStop[] = options?.venue
    ? [...WRITING_STOP_LIST, ...WRITING_STOP_PATTERNS, ...VENUE_COPY_RULES]
    : [...WRITING_STOP_LIST, ...WRITING_STOP_PATTERNS]
  const hits: WritingHit[] = []
  for (const rule of rules) {
    const match = matchRule(text, rule)
    if (match) {
      hits.push({ phrase: rule.phrase, match })
    }
  }
  return hits
}

export function writingCopy(parts: unknown[]) {
  const chunks: string[] = []
  for (const part of parts) {
    if (typeof part === 'string' && part.trim()) {
      chunks.push(part)
    } else if (part && typeof part === 'object') {
      chunks.push(JSON.stringify(part))
    }
  }
  return chunks.join('\n')
}

export function writingGuideSection() {
  const phrases = WRITING_STOP_LIST.map((item) => `- «${item.phrase}»: ${item.note}`).join('\n')
  const patterns = WRITING_STOP_PATTERNS.map((item) => `- ${item.phrase} (${item.pattern?.source}): ${item.note}`).join('\n')
  const venue = VENUE_COPY_RULES.map((item) => `- ${item.phrase}: ${item.note}`).join('\n')
  const sites = WRITING_BANNED_SITES.join(', ')
  return [
    'Tone: plain, specific, calm. Concrete facts, not adjectives. No slogans and no invented atmosphere.',
    '',
    'Stop-list. Source of truth: apps/web-app/shared/writing.ts (WRITING_STOP_LIST, WRITING_STOP_PATTERNS, VENUE_COPY_RULES, WRITING_BANNED_SITES). content_guide prints this section. .cursor/skills/k39-writing/SKILL.md repeats every phrase. apps/web-app/test/writing.test.ts fails if a phrase is missing from either place. Do not add a ban in only one file.',
    phrases,
    'Patterns:',
    patterns,
    'Venue prose (description, modules, FAQ, tips). Prices stay in the price blocks:',
    venue,
    `Never name ${sites}. Never paste another site's sentences, photos, or structure. Write from the sources, in our words.`,
    'Do not pad a page to reach a length minimum. Length ceilings and floors: .cursor/skills/k39-writing/SKILL.md.',
    'A draft save returns writingWarnings and still stores the row. Publishing rejects when writingHits is not empty.',
  ].join('\n')
}
