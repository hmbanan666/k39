import type { PageKind, PrimaryAction } from '../../../shared/scoring'
import { db } from '@k39/database'
import { buildWeeklyReport, filterScores, pageKindLabel, topIssue } from '../../../shared/scoring'
import { auditMcp } from '../mcp/audit'
import { catalogPageRefs, scoresFromCatalog, toStored } from './assemble'

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
  const scores = scoresFromCatalog(catalog, metrics, queries, searchImported, now)
  const stored = scores.map(toStored)
  await db.scoring.replaceScores(stored, now.toISOString())
  await db.scoring.upsertDays(today, stored)
  const pages = catalogPageRefs(catalog)
  await db.scoring.syncPassportPaths(pages)
  await db.scoring.deleteStalePassports(pages)
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
  return buildWeeklyReport(current, previous, { current: today, previous: previousDay })
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
  }
}

export async function writePassport(page: ResolvedPage, input: {
  targetQueries?: string[]
  audience?: string | null
  primaryAction?: PrimaryAction | null
  goal30d?: number | null
  goal90d?: number | null
  notes?: string | null
}) {
  await db.scoring.upsertPassport({
    pageType: page.pageType,
    entityId: page.entityId,
    path: page.path,
    targetQueries: input.targetQueries,
    audience: input.audience,
    primaryAction: input.primaryAction,
    goal30d: input.goal30d,
    goal90d: input.goal90d,
    notes: input.notes,
  })
  return readPassport(page)
}

export async function resolveScoredPage(input: { path?: string, pageType?: PageKind, slug?: string }): Promise<ResolvedPage | null> {
  const catalog = await db.scoring.loadCatalog()
  const pages: ResolvedPage[] = [
    ...catalog.places.map((row) => ({ pageType: 'place' as const, entityId: row.id, path: `/${row.slug}`, title: row.title, slug: row.slug })),
    ...catalog.routes.map((row) => ({ pageType: 'route' as const, entityId: row.id, path: `/marshruty/${row.slug}`, title: row.title, slug: row.slug })),
    ...catalog.collections.map((row) => ({ pageType: 'collection' as const, entityId: row.id, path: `/podborki/${row.slug}`, title: row.title, slug: row.slug })),
    ...catalog.quests.map((row) => ({ pageType: 'quest' as const, entityId: row.id, path: `/kvesty/${row.slug}`, title: row.title, slug: row.slug })),
    ...catalog.hubs.map((row) => ({ pageType: 'hub' as const, entityId: row.id, path: `/${row.slug}`, title: row.title, slug: row.slug })),
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
