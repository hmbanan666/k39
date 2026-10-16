import type { QueueReason } from '../../../shared/facts'
import type { ScheduleRules } from '../../../shared/schedule'
import type { PageSnapshot } from './pages'
import { db } from '@k39/database'
import { repeatedKinds } from '../../../shared/fact-prose'
import { pageTraffic, pastTtl, priorityFor, queueMayOpen, seasonBoundaryWithin, unreviewedSections } from '../../../shared/facts'
import { readRules, scheduleDetails } from '../../../shared/schedule'
import { loadPageSnapshots } from './pages'

function dayStamp(date: Date) {
  return date.toISOString().slice(0, 10)
}

function shiftDay(day: string, days: number) {
  const date = new Date(`${day}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return dayStamp(date)
}

function pathOf(page: string) {
  const trimmed = page.trim()
  if (!trimmed) {
    return ''
  }
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return new URL(trimmed).pathname.replace(/\/$/, '') || '/'
    }
  } catch {
    return trimmed
  }
  return trimmed.length > 1 && trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

/** Upsert TTL, season, and section rows, then store priority so queue_list does not join analytics. */
export async function syncVerificationQueue(now = new Date()) {
  const pages = await loadPageSnapshots()
  const byConsumer = new Map(pages.map((page) => [`${page.pageType}:${page.entityId}`, page]))
  const since = shiftDay(dayStamp(now), -30)
  const trafficRows = await db.facts.trafficSince(since)
  const views = new Map<string, number>()
  for (const row of trafficRows.views) {
    views.set(pathOf(row.path), (views.get(pathOf(row.path)) ?? 0) + Number(row.pageviews))
  }
  const impressions = new Map<string, number>()
  for (const row of trafficRows.impressions) {
    const key = pathOf(row.page)
    if (!key) {
      continue
    }
    impressions.set(key, (impressions.get(key) ?? 0) + Number(row.impressions))
  }
  const pageLoad = (path: string, status: string | null) => {
    if (status === 'draft' || status === 'archived') {
      return 0
    }
    return pageTraffic(views.get(path) ?? 0, impressions.get(path) ?? 0)
  }

  const live = await db.facts.liveFacts()
  const refs = await db.facts.refs()
  const refsByFact = new Map<string, typeof refs>()
  for (const ref of refs) {
    const list = refsByFact.get(ref.factId) ?? []
    list.push(ref)
    refsByFact.set(ref.factId, list)
  }

  for (const fact of live) {
    const consumers = refsByFact.get(fact.id) ?? []
    const shown = consumers.map((ref) => byConsumer.get(`${ref.consumerType}:${ref.consumerId}`)).filter((page): page is NonNullable<typeof page> => Boolean(page))
    const queueable = shown.some((page) => queueMayOpen(page.status, 'ttl_expired'))
    const home = shown[0]
    const traffic = shown.reduce((sum, page) => sum + pageLoad(page.path, page.status), 0)
    if (fact.checkedAt && !pastTtl(fact.checkedAt, fact.ttlDays, now)) {
      await closeReason(fact.id, 'ttl_expired')
    }
    if (fact.checkedAt && fact.sourceKind !== 'none') {
      await closeReason(fact.id, 'unseeded')
    }
    if (!queueable) {
      continue
    }
    const target = {
      target: 'fact' as const,
      factId: fact.id,
      pageType: home?.pageType ?? fact.subjectType,
      entityId: home?.entityId ?? fact.subjectId,
      path: consumers[0]?.path ?? fact.slot,
    }
    if (!fact.checkedAt || fact.sourceKind === 'none') {
      await db.facts.enqueue({ ...target, reason: 'unseeded', priority: priorityFor(fact.kind, 'unseeded', traffic || 1) })
    }
    if (fact.checkedAt && pastTtl(fact.checkedAt, fact.ttlDays, now)) {
      await db.facts.enqueue({ ...target, reason: 'ttl_expired', priority: priorityFor(fact.kind, 'ttl_expired', traffic || 1) })
    }
    if (fact.kind === 'hours' && readRules(fact.value) && seasonBoundaryWithin(readRules(fact.value)!, now)) {
      await db.facts.enqueue({
        target: 'fact',
        factId: fact.id,
        pageType: home?.pageType ?? fact.subjectType,
        entityId: home?.entityId ?? fact.subjectId,
        path: 'short.hours',
        reason: 'season_boundary',
        priority: priorityFor('hours', 'season_boundary', traffic || 1),
      })
    }
  }

  for (const page of pages) {
    const review = await db.facts.review(page.pageType, page.entityId)
    const missing = unreviewedSections(page.sections, review?.sections ?? [])
    const reviewed = new Set(page.sections.filter((section) => !missing.includes(section)).map((section) => section.path))
    for (const path of reviewed) {
      await db.facts.closeSection(page.pageType, page.entityId, path)
    }
    if (!queueMayOpen(page.status, 'section_changed')) {
      continue
    }
    const traffic = pageLoad(page.path, page.status)
    for (const section of missing) {
      await db.facts.enqueue({
        target: 'section',
        pageType: page.pageType,
        entityId: page.entityId,
        path: section.path,
        reason: 'section_changed',
        priority: priorityFor('prose', 'section_changed', traffic),
      })
    }
  }

  const open = await db.facts.openRows()
  const priorities = open.map((row) => {
    const page = row.pageType && row.entityId ? byConsumer.get(`${row.pageType}:${row.entityId}`) : undefined
    const factRefs = row.factId ? (refsByFact.get(row.factId) ?? []) : []
    const related = factRefs.map((ref) => byConsumer.get(`${ref.consumerType}:${ref.consumerId}`)).filter((item): item is NonNullable<typeof item> => Boolean(item))
    const traffic = related.length
      ? related.reduce((sum, item) => sum + pageLoad(item.path, item.status), 0)
      : page ? pageLoad(page.path, page.status) : 1
    return { id: row.id, priority: priorityFor(row.kind ?? 'prose', row.reason, traffic || 1) }
  })
  await db.facts.setPriorities(priorities)
  await syncRepeatedProse(pages, await venueRules())
  return { pages: pages.length, open: open.length }
}

/** A prose section that repeats the schedule or a phone is a review warning, not a publish block. */
export async function syncRepeatedProse(pages: PageSnapshot[], rulesByVenue: Map<string, ScheduleRules | null>) {
  for (const page of pages) {
    if (page.pageType !== 'venue' || !queueMayOpen(page.status, 'fact_repeated')) {
      continue
    }
    const lines = scheduleDetails(rulesByVenue.get(page.entityId) ?? null)
    for (const section of page.sections) {
      const repeats = repeatedKinds(section.text, lines)
      if (!repeats.length) {
        await db.facts.closeSection(page.pageType, page.entityId, section.path, 'fact_repeated')
        continue
      }
      await db.facts.enqueue({
        target: 'section',
        pageType: page.pageType,
        entityId: page.entityId,
        path: section.path,
        reason: 'fact_repeated',
        priority: priorityFor('prose', 'fact_repeated', 1),
        proposal: { repeats },
      })
    }
  }
}

async function venueRules() {
  const rows = await db.schedules.list('venue')
  return new Map(rows.map((row) => [row.entityId, readRules(row.rules)]))
}

async function closeReason(factId: string, reason: QueueReason) {
  const rows = await db.facts.openRows()
  const match = rows.find((row) => row.factId === factId && row.reason === reason)
  if (match) {
    await db.facts.close(match.id)
  }
}

export async function syncPageSections(pageType: string, entityId: string) {
  const page = (await loadPageSnapshots()).find((item) => item.pageType === pageType && item.entityId === entityId)
  if (!page) {
    return
  }
  const review = await db.facts.review(page.pageType, page.entityId)
  const missing = unreviewedSections(page.sections, review?.sections ?? [])
  for (const section of page.sections) {
    if (!missing.some((item) => item.path === section.path)) {
      await db.facts.closeSection(page.pageType, page.entityId, section.path)
    }
  }
  if (!queueMayOpen(page.status, 'section_changed')) {
    return
  }
  for (const section of missing) {
    await db.facts.enqueue({
      target: 'section',
      pageType: page.pageType,
      entityId: page.entityId,
      path: section.path,
      reason: 'section_changed',
      priority: priorityFor('prose', 'section_changed', 1),
    })
  }
  if (page.pageType === 'venue') {
    const row = await db.schedules.get('venue', page.entityId)
    await syncRepeatedProse([page], new Map([[page.entityId, row ? readRules(row.rules) : null]]))
  }
}
