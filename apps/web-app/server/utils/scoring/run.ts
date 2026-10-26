import type { LengthOverrideInput } from '../../../shared/length-override'
import type { PageKind, PrimaryAction } from '../../../shared/scoring'
import { db } from '@k39/database'
import { lengthOverrideRejection, stampLengthOverride } from '../../../shared/length-override'
import { buildWeeklyReport, filterScores, lengthNorm, pageKindLabel, topIssue } from '../../../shared/scoring'
import { savePassportContent } from '../content/save'
import { syncVerificationQueue } from '../facts/queue'
import { auditMcp } from '../mcp/audit'
import { pendingVenueWrite } from '../venues/pending'
import { catalogPageRefs, scoreFactRefs, scoresFromCatalog, toStored } from './assemble'
import { catalogWithPendingPlace, findCatalogPage, scorePreview } from './preview'

function dayStamp(date: Date) {
  return date.toISOString().slice(0, 10)
}

function shiftDay(day: string, days: number) {
  const date = new Date(`${day}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return dayStamp(date)
}

export async function refreshContentScores(options?: { force?: boolean }) {
  const today = dayStamp(new Date())
  if (!options?.force) {
    const claimed = await db.analytics.claimRun(today, 'content-scores')
    if (!claimed) {
      return { skipped: true, pages: 0 }
    }
  }
  const now = new Date()
  const catalog = await db.scoring.loadCatalog()
  const metrics = await db.scoring.pageMetrics(now)
  const queries = await db.scoring.searchQueriesSince(shiftDay(today, -90))
  const searchImported = await db.scoring.searchImported()
  const freshness = await db.facts.freshnessByConsumer(now.toISOString())
  const factRefs = scoreFactRefs(freshness)
  const scores = scoresFromCatalog(catalog, metrics, queries, searchImported, now, factRefs)
  const stored = scores.map(toStored)
  await db.scoring.replaceScores(stored, now.toISOString())
  await db.scoring.upsertDays(today, stored)
  const pages = catalogPageRefs(catalog)
  await db.scoring.syncPassportPaths(pages)
  await db.scoring.deleteStalePassports(pages)
  await syncVerificationQueue(now)
  return { skipped: false, pages: scores.length, scoredAt: now.toISOString() }
}

export async function listContentScores(query: {
  pageType?: PageKind
  block?: 'quality' | 'linking' | 'indexing' | 'results'
  below?: number
  sort?: 'total' | 'quality' | 'linking' | 'indexing' | 'results' | 'title' | 'path'
  order?: 'asc' | 'desc'
}) {
  const rows = await db.scoring.listScores()
  return filterScores(rows, query).map((row) => ({
    ...row,
    typeLabel: pageKindLabel(row.pageType),
    topIssue: topIssue(row.checks, row),
  }))
}

export async function getContentScore(path: string) {
  const row = await db.scoring.scoreByPath(path)
  if (!row) {
    return null
  }
  return { ...row, topIssue: topIssue(row.checks, row) }
}

export async function weeklyContentReport() {
  const today = dayStamp(new Date())
  const current = await db.scoring.listScores()
  const previousDay = await db.scoring.latestDayOnOrBefore(shiftDay(today, -7))
  const previous = previousDay ? await db.scoring.scoresForDay(previousDay) : null
  const report = buildWeeklyReport(current, previous, { current: today, previous: previousDay })
  const [byReason, top] = await Promise.all([db.facts.countsByReason(), db.facts.topOpen(10)])
  const open = await db.facts.openRows()
  const openKeys = new Set(open.map((row) => `${row.pageType}:${row.entityId}`))
  const goalAndQueue = current
    .filter(
      (row) => row.goal30d != null && row.organic30d < row.goal30d && openKeys.has(`${row.pageType}:${row.entityId}`),
    )
    .map((row) => ({
      path: row.path,
      title: row.title,
      organic30d: row.organic30d,
      goal30d: row.goal30d,
    }))
  return {
    ...report,
    queue: {
      byReason: Object.fromEntries(byReason.map((row) => [row.reason, Number(row.count)])),
      top: top.map((row) => ({
        id: row.id,
        reason: row.reason,
        priority: row.priority,
        kind: row.kind,
        slot: row.slot,
        pageType: row.pageType ?? row.subjectType,
        entityId: row.entityId ?? row.subjectId,
        path: row.path,
      })),
    },
    goalAndQueue,
  }
}

/**
 * On-demand score for a draft, a review page, or a place's pending payload.
 * Reads the same catalog and metrics as a refresh and does not write
 * `content_scores` or `content_score_days`.
 */
export async function previewContentScore(path: string) {
  const normalized = normalizePath(path)
  const now = new Date()
  const today = dayStamp(now)
  const catalog = await db.scoring.loadCatalog()
  const page = findCatalogPage(catalog, normalized)
  if (!page) {
    return null
  }
  let source: 'live' | 'draft' | 'pending' = page.publicationStatus === 'published' ? 'live' : 'draft'
  let working = catalog
  if (page.pageType === 'place') {
    const draft = await db.editor.contentDraft('place', page.entityId)
    const current = catalog.places.find((row) => row.id === page.entityId)
    if (draft && current) {
      const live = await db.editor.placeById(page.entityId)
      if (live) {
        const next = db.editor.pendingPlaceNext(live, draft.payload)
        let categorySlug = current.categorySlug
        let categoryTitle = current.categoryTitle
        if (next.categoryId !== live.categoryId) {
          const categories = await db.content.categories()
          const category = categories.find((row) => row.id === next.categoryId)
          categorySlug = category?.slug ?? null
          categoryTitle = category?.title ?? null
        }
        let regionTitle = current.regionTitle
        if (next.regionId !== live.regionId) {
          const regionRows = await db.editor.listRegions()
          regionTitle = regionRows.find((row) => row.id === next.regionId)?.title ?? null
        }
        source = 'pending'
        working = catalogWithPendingPlace(catalog, page.entityId, next, {
          categorySlug,
          categoryTitle,
          regionTitle,
        })
      }
    }
  }
  if (page.pageType === 'venue') {
    const draft = await db.editor.contentDraft('venue', page.entityId)
    const current = await db.venues.byId(page.entityId)
    if (draft && current) {
      const fields = await pendingVenueWrite((draft.payload.fields ?? {}) as Parameters<typeof pendingVenueWrite>[0])
      const next = await db.venues.prepareUpdate(current, fields, false)
      const region = (await db.editor.listRegions()).find((row) => row.id === next.regionId)
      source = 'pending'
      working = {
        ...catalog,
        venues: catalog.venues.map((row) => {
          if (row.id !== current.id) {
            return row
          }
          const schedule = Object.hasOwn(draft.payload, 'schedule')
            ? (draft.payload.schedule as typeof row.schedule)
            : row.schedule
          return {
            ...row,
            name: next.name,
            kind: next.kind,
            description: next.description,
            latitude: next.latitude,
            longitude: next.longitude,
            factsCheckedAt: next.lastVerifiedAt,
            regionSlug: region?.slug ?? null,
            regionTitle: region?.title ?? null,
            schedule,
          }
        }),
      }
    }
  }
  const [metrics, queries, searchImported, freshness] = await Promise.all([
    db.scoring.pageMetrics(now),
    db.scoring.searchQueriesSince(shiftDay(today, -90)),
    db.scoring.searchImported(),
    db.facts.freshnessByConsumer(now.toISOString()),
  ])
  const factRefs = scoreFactRefs(freshness)
  return scorePreview({
    catalog: working,
    pageType: page.pageType,
    entityId: page.entityId,
    source,
    publicationStatus: page.publicationStatus,
    metrics,
    queries,
    searchImported,
    now,
    factRefs,
  })
}

export async function auditedScore<T>(tool: string, entityId: string | null, run: () => Promise<T>) {
  const result = await run()
  await auditMcp(tool, 'score', entityId)
  return result
}

export function normalizePath(path: string) {
  const trimmed = path.trim()
  if (!trimmed.startsWith('/')) {
    return `/${trimmed}`
  }
  return trimmed.length > 1 && trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

export interface ResolvedPage {
  pageType: PageKind
  entityId: string
  path: string
  title: string
  slug: string
  categorySlug: string | null
}

export async function readPassport(page: ResolvedPage) {
  const catalog = await db.scoring.loadCatalog()
  const row = catalog.passports.find((item) => item.pageType === page.pageType && item.entityId === page.entityId)
  return {
    pageType: page.pageType,
    entityId: page.entityId,
    path: page.path,
    title: page.title,
    slug: page.slug,
    targetQueries: row?.targetQueries ?? [],
    audience: row?.audience ?? null,
    primaryAction: row?.primaryAction ?? null,
    goal30d: row?.goal30d ?? null,
    goal90d: row?.goal90d ?? null,
    notes: row?.notes ?? null,
    lengthOverride: row?.lengthOverride ?? null,
  }
}

export async function writePassport(
  page: ResolvedPage,
  input: {
    targetQueries?: string[]
    audience?: string | null
    primaryAction?: PrimaryAction | null
    goal30d?: number | null
    goal90d?: number | null
    notes?: string | null
    lengthOverride?: LengthOverrideInput | null
  },
) {
  let lengthOverride: Awaited<ReturnType<typeof stampLengthOverride>> | undefined
  if (input.lengthOverride !== undefined) {
    if (input.lengthOverride) {
      const reason =
        page.pageType === 'venue'
          ? 'Для заведения потолок длины не расширяется'
          : lengthOverrideRejection(lengthNorm(page.pageType, page.categorySlug).max, input.lengthOverride)
      if (reason) {
        throw createError({ statusCode: 400, statusMessage: reason })
      }
    }
    const previous = input.lengthOverride
      ? ((await db.scoring.findPassport(page.pageType, page.entityId))?.lengthOverride ?? null)
      : null
    lengthOverride = stampLengthOverride(input.lengthOverride, previous)
  }
  await savePassportContent(
    {
      pageType: page.pageType,
      entityId: page.entityId,
      path: page.path,
      targetQueries: input.targetQueries,
      audience: input.audience,
      primaryAction: input.primaryAction,
      goal30d: input.goal30d,
      goal90d: input.goal90d,
      notes: input.notes,
      ...(lengthOverride !== undefined ? { lengthOverride } : {}),
    },
    {
      prose: [input.notes, input.audience, input.targetQueries],
      publishing: false,
    },
  )
  return readPassport(page)
}

export async function resolveScoredPage(input: {
  path?: string
  pageType?: PageKind
  slug?: string
}): Promise<ResolvedPage | null> {
  const catalog = await db.scoring.loadCatalog()
  const pages: ResolvedPage[] = [
    ...catalog.places.map((row) => ({
      pageType: 'place' as const,
      entityId: row.id,
      path: `/${row.slug}`,
      title: row.title,
      slug: row.slug,
      categorySlug: row.categorySlug,
    })),
    ...catalog.routes.map((row) => ({
      pageType: 'route' as const,
      entityId: row.id,
      path: `/marshruty/${row.slug}`,
      title: row.title,
      slug: row.slug,
      categorySlug: null,
    })),
    ...catalog.collections.map((row) => ({
      pageType: 'collection' as const,
      entityId: row.id,
      path: `/podborki/${row.slug}`,
      title: row.title,
      slug: row.slug,
      categorySlug: null,
    })),
    ...catalog.quests.map((row) => ({
      pageType: 'quest' as const,
      entityId: row.id,
      path: `/kvesty/${row.slug}`,
      title: row.title,
      slug: row.slug,
      categorySlug: null,
    })),
    ...catalog.hubs.map((row) => ({
      pageType: 'hub' as const,
      entityId: row.id,
      path: `/${row.slug}`,
      title: row.title,
      slug: row.slug,
      categorySlug: row.slug,
    })),
    ...catalog.venues.map((row) => ({
      pageType: 'venue' as const,
      entityId: row.id,
      path: `/zavedeniya/${row.slug}`,
      title: row.name,
      slug: row.slug,
      categorySlug: row.kind,
    })),
  ]
  if (input.path) {
    const path = normalizePath(input.path)
    return pages.find((page) => page.path === path) ?? null
  }
  if (input.pageType && input.slug) {
    return pages.find((page) => page.pageType === input.pageType && page.slug === input.slug) ?? null
  }
  return null
}
