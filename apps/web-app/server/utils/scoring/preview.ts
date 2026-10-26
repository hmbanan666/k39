import type { ContentCatalog, PageMetric, ScorePlace } from '@k39/database'
import type { PageKind, ScoreFactRefs } from '../../../shared/scoring'
import { topIssue } from '../../../shared/scoring'
import { scoresFromCatalog } from './assemble'

export type ScorePreviewSource = 'live' | 'draft' | 'pending'

export interface CatalogPageHit {
  pageType: PageKind
  entityId: string
  path: string
  publicationStatus: 'draft' | 'review' | 'published'
}

/**
 * The page a preview would score. Drafts and reviews stay in the catalog;
 * archived rows do not. Places are matched before hubs, the same order as
 * `resolveScoredPage`.
 */
export function findCatalogPage(catalog: ContentCatalog, path: string): CatalogPageHit | null {
  const pages: CatalogPageHit[] = [
    ...catalog.places.map((row) => ({
      pageType: 'place' as const,
      entityId: row.id,
      path: `/${row.slug}`,
      publicationStatus: row.publicationStatus,
    })),
    ...catalog.routes.map((row) => ({
      pageType: 'route' as const,
      entityId: row.id,
      path: `/marshruty/${row.slug}`,
      publicationStatus: row.publicationStatus,
    })),
    ...catalog.collections.map((row) => ({
      pageType: 'collection' as const,
      entityId: row.id,
      path: `/podborki/${row.slug}`,
      publicationStatus: row.publicationStatus,
    })),
    ...catalog.quests.map((row) => ({
      pageType: 'quest' as const,
      entityId: row.id,
      path: `/kvesty/${row.slug}`,
      publicationStatus: row.publicationStatus,
    })),
    ...catalog.hubs.map((row) => ({
      pageType: 'hub' as const,
      entityId: row.id,
      path: `/${row.slug}`,
      publicationStatus: 'published' as const,
    })),
    ...catalog.venues.map((row) => ({
      pageType: 'venue' as const,
      entityId: row.id,
      path: `/zavedeniya/${row.slug}`,
      publicationStatus: row.publicationStatus,
    })),
  ]
  return pages.find((page) => page.path === path) ?? null
}

export interface PendingPlaceFields {
  slug: string
  title: string
  summary: string | null
  body: string
  howToGet: string | null
  hours: string | null
  price: string | null
  latitude: number | null
  longitude: number | null
  regionId: string | null
  noindex: boolean
  seoTitle: string | null
  seoDescription: string | null
  sources: unknown
  faq: unknown
  lastVerifiedAt: string | null
  schemaType?: string | null
}

export interface PendingPlaceLabels {
  categorySlug: string | null
  categoryTitle: string | null
  regionTitle: string | null
}

function pairs(value: unknown, left: string, right: string) {
  if (!Array.isArray(value)) {
    return null
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }
    const record = item as Record<string, unknown>
    const a = typeof record[left] === 'string' ? record[left].trim() : ''
    const b = typeof record[right] === 'string' ? record[right].trim() : ''
    return a && b ? [{ [left]: a, [right]: b }] : []
  })
}

/**
 * A copy of the catalog whose place row carries the pending payload.
 * Publication status stays the live row: the public URL has not changed.
 * Scoring still runs through `scoresFromCatalog`.
 */
export function catalogWithPendingPlace(
  catalog: ContentCatalog,
  entityId: string,
  next: PendingPlaceFields,
  labels: PendingPlaceLabels,
): ContentCatalog {
  return {
    ...catalog,
    places: catalog.places.map((place) => {
      if (place.id !== entityId) {
        return place
      }
      const faq = (pairs(next.faq, 'question', 'answer') ?? place.faq) as ScorePlace['faq']
      const sources = (pairs(next.sources, 'title', 'url') ?? place.sources) as ScorePlace['sources']
      return {
        ...place,
        slug: next.slug,
        title: next.title,
        summary: next.summary ?? '',
        body: next.body,
        howToGet: next.howToGet,
        hours: next.hours,
        price: next.price,
        latitude: next.latitude,
        longitude: next.longitude,
        regionId: next.regionId,
        regionTitle: labels.regionTitle,
        categorySlug: labels.categorySlug,
        categoryTitle: labels.categoryTitle,
        schemaType: next.schemaType === undefined ? place.schemaType : next.schemaType,
        noindex: next.noindex,
        seoTitle: next.seoTitle,
        seoDescription: next.seoDescription,
        factsCheckedAt: next.lastVerifiedAt,
        sources,
        faq,
        faqCount: faq.length,
      }
    }),
  }
}

const DRAFT_NOTE =
  'Preview of the draft row. Not written to content_scores. Traffic results are not applicable. HTTP status and the sitemap check are not applicable until the page is published, and those points are left out of the average.'
const PENDING_NOTE =
  'Preview of the pending payload. Not written to content_scores. Traffic results are not applicable.'
const LIVE_NOTE = 'Preview of the live row. Not written to content_scores.'

type UnpublishedIndexing = 'not 200' | 'not in sitemap'

/**
 * A draft is not on the public URL yet, so "not 200" and "not in sitemap"
 * are not failures. Each is 20 indexing points, and a waived check is left
 * out of the average. The sitemap bucket is also the noindex penalty, so an
 * editorial `noindex` keeps "not in sitemap" as a real check. Pending
 * payloads keep the scored indexing.
 */
function draftIndexing(checks: string[], points: number) {
  const waived: UnpublishedIndexing[] = []
  let indexing = points
  if (checks.includes('not 200')) {
    waived.push('not 200')
    indexing += 20
  }
  if (checks.includes('not in sitemap') && !checks.includes('noindex')) {
    waived.push('not in sitemap')
    indexing += 20
  }
  return {
    indexing: Math.min(100, indexing),
    checks: [
      ...checks.filter((check) => !waived.includes(check as UnpublishedIndexing)),
      ...waived.map((check) => `${check}: not applicable`),
    ],
    waived,
  }
}

/**
 * One page scored with the same rules as a stored score. Drafts and reviews
 * are included for this id only. Nothing is written. Traffic results are
 * omitted unless the source is the live row, because a draft has no public audience.
 */
export function scorePreview(input: {
  catalog: ContentCatalog
  pageType: PageKind
  entityId: string
  source: ScorePreviewSource
  publicationStatus: CatalogPageHit['publicationStatus']
  metrics?: PageMetric[]
  queries?: Array<{ page: string; query: string }>
  searchImported?: boolean
  now?: Date
  factRefs?: Map<string, ScoreFactRefs>
}) {
  const now = input.now ?? new Date()
  const scores = scoresFromCatalog(
    input.catalog,
    input.metrics ?? [],
    input.queries ?? [],
    input.searchImported ?? false,
    now,
    input.factRefs,
    { include: [{ kind: input.pageType, id: input.entityId }] },
  )
  const score = scores.find((row) => row.pageType === input.pageType && row.entityId === input.entityId)
  if (!score) {
    return null
  }
  const resultsApplicable = input.source === 'live'
  const indexing =
    input.source === 'draft'
      ? draftIndexing(score.checks.indexing, score.indexing)
      : { indexing: score.indexing, checks: score.checks.indexing, waived: [] as string[] }
  const checks = {
    ...score.checks,
    indexing: indexing.checks,
    results: resultsApplicable ? score.checks.results : ['not applicable'],
  }
  const total = resultsApplicable ? score.total : Math.round((score.quality + score.linking + indexing.indexing) / 3)
  let note = LIVE_NOTE
  if (input.source === 'pending') {
    note = PENDING_NOTE
  } else if (input.source === 'draft') {
    note = DRAFT_NOTE
  }
  return {
    preview: true as const,
    source: input.source,
    resultsApplicable,
    publicationStatus: input.publicationStatus,
    path: score.path,
    title: score.title,
    pageType: score.pageType,
    entityId: score.entityId,
    total,
    quality: score.quality,
    linking: score.linking,
    indexing: indexing.indexing,
    results: resultsApplicable ? score.results : null,
    checks,
    notApplicable: [...(resultsApplicable ? [] : ['results']), ...indexing.waived],
    signals: score.signals,
    topIssue: topIssue(
      {
        ...checks,
        indexing: checks.indexing.filter((check) => !check.endsWith('not applicable')),
        results: resultsApplicable ? checks.results : [],
      },
      {
        quality: score.quality,
        linking: score.linking,
        indexing: indexing.indexing,
        results: resultsApplicable ? score.results : 100,
      },
    ),
    note,
  }
}

export type ScorePreview = NonNullable<ReturnType<typeof scorePreview>>
