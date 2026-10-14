// Place and route bodies as typed sections (ADR 0027). Standard sections take
// their heading from STANDARD_SECTION_TITLES, so content never stores it; free
// text sections carry their own heading. The markdown body is derived from
// the sections on every save and kept as the readable archive.

export const STANDARD_SECTION_TITLES = {
  useful: 'Полезно знать',
  directions: 'Как добраться',
} as const

export type StandardSectionKind = keyof typeof STANDARD_SECTION_TITLES

/** Old headings that still map to a standard section when a body is split. */
const HEADING_KIND: Record<string, StandardSectionKind> = {
  'полезно знать': 'useful',
  'практика': 'useful',
  'как добраться': 'directions',
}

export type BodySection
  = | { kind: 'text', title?: string, text: string }
    | { kind: StandardSectionKind, text: string }

function headingKind(title: string): StandardSectionKind | null {
  return HEADING_KIND[title.trim().toLowerCase()] ?? null
}

/** Splits a markdown body on level-2 headings, keeping every line verbatim. */
export function splitBody(markdown: string): BodySection[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const sections: BodySection[] = []
  let title: string | null = null
  let buffer: string[] = []
  let fenced = false
  const flush = () => {
    const text = buffer.join('\n').trim()
    if (title === null) {
      if (text) {
        sections.push({ kind: 'text', text })
      }
    } else {
      const kind = headingKind(title)
      sections.push(kind ? { kind, text } : { kind: 'text', title, text })
    }
    buffer = []
  }
  for (const line of lines) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      fenced = !fenced
    }
    const heading = fenced ? null : /^##[ \t]+(\S.*)$/.exec(line)
    if (heading) {
      flush()
      title = heading[1]!.replace(/[\s#]+$/, '')
      continue
    }
    buffer.push(line)
  }
  flush()
  return sections
}

export function sectionTitle(section: BodySection) {
  return section.kind === 'text' ? section.title : STANDARD_SECTION_TITLES[section.kind]
}

/** Markdown for the sections, headings from the registry for standard ones. */
export function composeBody(sections: readonly BodySection[]) {
  return sections
    .map((section) => {
      const title = sectionTitle(section)
      const text = section.text.trim()
      return title ? (text ? `## ${title}\n\n${text}` : `## ${title}`) : text
    })
    .filter(Boolean)
    .join('\n\n')
}

/** Reads stored sections, dropping anything that is not a known shape. */
export function readSections(value: unknown): BodySection[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((item): BodySection[] => {
    if (!item || typeof item !== 'object' || typeof item.text !== 'string') {
      return []
    }
    if (item.kind === 'text') {
      return [typeof item.title === 'string' && item.title.trim() ? { kind: 'text', title: item.title.trim(), text: item.text } : { kind: 'text', text: item.text }]
    }
    return item.kind in STANDARD_SECTION_TITLES ? [{ kind: item.kind as StandardSectionKind, text: item.text }] : []
  })
}

/** The body a page renders: composed from sections when it has them. */
export function bodyOf(row: { body: string, sections?: unknown }) {
  const sections = readSections(row.sections)
  return sections.length ? composeBody(sections) : row.body
}

/** Comparable form of a body: whitespace runs collapsed. */
export function bodyFingerprint(markdown: string) {
  return markdown.replace(/\s+/g, ' ').trim()
}
