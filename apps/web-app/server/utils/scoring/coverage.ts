import type { ContentCatalog, PageKind } from '@k39/database'
import type { CoveragePage } from '../../../shared/persona-coverage'
import type { PersonaCode } from '../../../shared/personas'
import { COVERAGE_GAP, pageBlocks, personaCoverage } from '../../../shared/persona-coverage'
import { orderPagePersonas, PERSONA_CODES } from '../../../shared/personas'
import { catalogHoursKnown, catalogPageRefs } from './assemble'

interface StoredPersona {
  pageType: PageKind
  entityId: string
  personaCode: string
  weight: number
  primary: boolean
}

function emptyPage(pageType: CoveragePage['pageType']): CoveragePage {
  return {
    pageType,
    hasBody: false,
    modules: [],
    stops: 0,
    sources: 0,
    faq: 0,
    hours: false,
    price: false,
    howToGet: false,
  }
}

/** What each catalog page provides, keyed by `type:id`. */
export function coveragePages(catalog: ContentCatalog) {
  const pages = new Map<string, { title: string; page: CoveragePage }>()
  const count = (stops: Array<{ parentId: string }>, id: string) => stops.filter((stop) => stop.parentId === id).length
  for (const row of catalog.places) {
    pages.set(`place:${row.id}`, {
      title: row.title,
      page: {
        ...emptyPage('place'),
        hasBody: Boolean(row.body.trim()),
        sources: row.sources.length,
        faq: row.faqCount,
        hours: catalogHoursKnown(row.schedule) || Boolean(row.hours),
        price: Boolean(row.price),
        howToGet: Boolean(row.howToGet),
      },
    })
  }
  const articles = [
    ['route', catalog.routes, catalog.routeStops],
    ['collection', catalog.collections, catalog.collectionStops],
    ['quest', catalog.quests, catalog.questStops],
  ] as const
  for (const [pageType, rows, stops] of articles) {
    for (const row of rows) {
      pages.set(`${pageType}:${row.id}`, {
        title: row.title,
        page: {
          ...emptyPage(pageType),
          hasBody: Boolean(row.body.trim()),
          modules: row.modules as CoveragePage['modules'],
          stops: count(stops, row.id),
          sources: row.sourcesCount,
        },
      })
    }
  }
  for (const row of catalog.hubs) {
    const stops = catalog.places.filter(
      (place) => place.categorySlug === row.slug && place.publicationStatus === 'published',
    ).length
    pages.set(`hub:${row.id}`, {
      title: row.title,
      page: { ...emptyPage('hub'), hasBody: Boolean(row.body.trim()), stops },
    })
  }
  for (const row of catalog.venues) {
    pages.set(`venue:${row.id}`, {
      title: row.name,
      page: { ...emptyPage('venue'), hasBody: Boolean(row.description.trim()), hours: catalogHoursKnown(row.schedule) },
    })
  }
  return pages
}

export interface CoverageRow {
  pageType: PageKind
  entityId: string
  path: string
  title: string
  /** Coverage for every persona; targets carry weight and primary. */
  cells: Array<{
    code: PersonaCode
    score: number
    missing: string[]
    weight: number | null
    primary: boolean
    gap: boolean
  }>
}

/** Page × persona coverage for pages with assigned personas. */
export function personaCoverageReport(catalog: ContentCatalog, stored: StoredPersona[]) {
  const pages = coveragePages(catalog)
  const byPage = new Map<string, StoredPersona[]>()
  for (const row of stored) {
    const key = `${row.pageType}:${row.entityId}`
    byPage.set(key, [...(byPage.get(key) ?? []), row])
  }
  const rows: CoverageRow[] = []
  let untargeted = 0
  for (const ref of catalogPageRefs(catalog)) {
    const key = `${ref.pageType}:${ref.entityId}`
    const info = pages.get(key)
    if (!info) {
      continue
    }
    const targets = orderPagePersonas(byPage.get(key) ?? [])
    if (!targets.length) {
      untargeted++
      continue
    }
    const blocks = pageBlocks(info.page)
    rows.push({
      ...ref,
      title: info.title,
      cells: PERSONA_CODES.map((code) => {
        const target = targets.find((item) => item.personaCode === code)
        const coverage = personaCoverage(code, blocks)
        return {
          ...coverage,
          weight: target?.weight ?? null,
          primary: target?.primary ?? false,
          gap: Boolean(target) && coverage.score < COVERAGE_GAP,
        }
      }),
    })
  }
  return { rows, untargeted }
}
