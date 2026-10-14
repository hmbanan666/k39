import type { PublicPageModule } from './page-modules'
import { headingId } from './reader-nav'

// Page blocks outside the article body, for the table of contents. Each
// block has one id and one title here; the page renders the block with that
// id and passes the same entry to ReaderLayout only when the block renders.

export interface PageSection {
  id: string
  title: string
}

export const PAGE_SECTIONS = {
  stops: { id: 'ostanovki', title: 'Остановки' },
  nearby: { id: 'ryadom', title: 'Рядом' },
  directions: { id: 'kak-dobratsya', title: 'Как добраться' },
  eatNearby: { id: 'gde-poest', title: 'Где поесть рядом' },
  faq: { id: 'voprosy', title: 'Вопросы перед поездкой' },
  places: { id: 'mesta', title: 'Места' },
  map: { id: 'karta', title: 'На карте' },
  routes: { id: 'marshruty', title: 'Маршруты' },
  gallery: { id: 'foto', title: 'Фотографии' },
  // Not listed in the contents: the block stays, but it is not a reading stop.
  sources: { id: 'istochniki', title: 'Источники' },
} as const satisfies Record<string, PageSection>

/** Picks the registry entries whose block renders, in the given order. */
export function presentSections(entries: Array<[PageSection, boolean]>, titles: Partial<Record<string, string>> = {}): PageSection[] {
  return entries.filter(([, shown]) => shown).map(([section]) => ({ id: section.id, title: titles[section.id] ?? section.title }))
}

/** Anchor of each module, aligned with the list; untitled modules get none. */
export function moduleAnchors(modules: readonly PublicPageModule[], rendered: (module: PublicPageModule) => boolean = () => true): Array<PageSection | null> {
  const used = new Map<string, number>()
  return modules.map((module) => {
    const title = 'title' in module && typeof module.title === 'string' ? module.title.trim() : ''
    if (!title || module.type === 'months' || !rendered(module)) {
      return null
    }
    return { id: headingId(title, used, 'b-'), title }
  })
}
