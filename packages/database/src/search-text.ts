// Query text handling for site search (ADR 0030). Pure functions, shared by
// the repository and the web app.

export const SEARCH_QUERY_MAX = 100
export const SEARCH_SURFACES = ['header', 'page', '404'] as const
export type SearchSurface = (typeof SEARCH_SURFACES)[number]

const LATIN = /[a-z]/
const EN_KEYS = 'qwertyuiop[]asdfghjkl;\'zxcvbnm,.`'
const RU_KEYS = 'йцукенгшщзхъфывапролджэячсмитьбюё'
const LAYOUT = new Map([...EN_KEYS].map((key, index) => [key, RU_KEYS[index]!]))

// Longest Latin sequences first, so "sch" wins over "s" + "ch".
const TRANSLIT: Array<[string, string]> = [
  ['shch', 'щ'],
  ['sch', 'щ'],
  ['zh', 'ж'],
  ['kh', 'х'],
  ['ts', 'ц'],
  ['ch', 'ч'],
  ['sh', 'ш'],
  ['yu', 'ю'],
  ['ju', 'ю'],
  ['ya', 'я'],
  ['ja', 'я'],
  ['yo', 'е'],
  ['ye', 'е'],
  ['ä', 'е'],
  ['ö', 'е'],
  ['ü', 'ю'],
  ['ß', 'сс'],
  ['a', 'а'],
  ['b', 'б'],
  ['c', 'к'],
  ['d', 'д'],
  ['e', 'е'],
  ['f', 'ф'],
  ['g', 'г'],
  ['h', 'х'],
  ['i', 'и'],
  ['j', 'й'],
  ['k', 'к'],
  ['l', 'л'],
  ['m', 'м'],
  ['n', 'н'],
  ['o', 'о'],
  ['p', 'п'],
  ['q', 'к'],
  ['r', 'р'],
  ['s', 'с'],
  ['t', 'т'],
  ['u', 'у'],
  ['v', 'в'],
  ['w', 'в'],
  ['x', 'кс'],
  ['y', 'ы'],
  ['z', 'з'],
]

/** Lower case, ё to е, punctuation to spaces, collapsed whitespace, capped length. */
export function normalizeSearchQuery(input: unknown) {
  return String(input ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .slice(0, SEARCH_QUERY_MAX)
    .trim()
}

/** The same keys typed on the Russian layout. */
export function swapKeyboardLayout(text: string) {
  return [...text].map((char) => LAYOUT.get(char) ?? char).join('').replace(/ё/g, 'е')
}

export function transliterate(text: string) {
  let out = ''
  let index = 0
  while (index < text.length) {
    const pair = TRANSLIT.find(([latin]) => text.startsWith(latin, index))
    if (pair) {
      out += pair[1]
      index += pair[0].length
    } else {
      out += text[index]
      index += 1
    }
  }
  return out
}

/**
 * Normalized query plus, for Latin input, the wrong-layout and the
 * transliterated readings. Raw input is the source for the layout swap,
 * because `[`, `;` and `,` stand for Russian letters there.
 */
export function searchVariants(input: unknown) {
  const normalized = normalizeSearchQuery(input)
  const variants = normalized ? [normalized] : []
  const raw = String(input ?? '').toLowerCase().trim().slice(0, SEARCH_QUERY_MAX)
  if (LATIN.test(normalized)) {
    variants.push(normalizeSearchQuery(swapKeyboardLayout(raw)))
    variants.push(normalizeSearchQuery(transliterate(normalized)))
  }
  return [...new Set(variants.filter(Boolean))]
}

/** Prefix tsquery text: every token is a prefix term joined with AND. */
export function prefixTsQuery(variant: string) {
  const tokens = variant.split(' ').filter(Boolean).slice(0, 8)
  return tokens.map((token) => `${token}:*`).join(' & ')
}

export function isSearchSurface(value: unknown): value is SearchSurface {
  return typeof value === 'string' && (SEARCH_SURFACES as readonly string[]).includes(value)
}
