import type { PassportWrite, VenueWrite } from '@k39/database'
import type { WritingEntity } from '../../../shared/writing-split'
import { db } from '@k39/database'
import { normalizeProse } from '../../../shared/facts'
import { writingCopy } from '../../../shared/writing'
import { writingSplit } from '../../../shared/writing-split'
import { syncPageSections } from '../facts/queue'
import { writingGate } from '../mcp/writing-guard'

/**
 * Every content-table write from MCP, REST, admin, and the cabinet goes
 * through this module. Callers prepare the row. They do not call the
 * repository writer, the stop-list, or section sync themselves.
 *
 * The hook normalizes prose, runs the stop-list, writes the row, drops
 * review hashes that no longer match, and enqueues sections that changed.
 * A pending draft is stored without touching the live page's hashes.
 */

export interface ContentGate {
  /** Prose we write. The stop-list and venue copy rules read this. */
  prose: unknown[]
  /** Official names and URLs. Banned sites read this; the stop-list does not. */
  names?: unknown[]
  /** A published result rejects hits before the write. */
  publishing: boolean
  /** Venue copy also checks price retelling in prose. */
  venue?: boolean
}

type PlaceWrite = Parameters<typeof db.editor.savePlace>[0]
type RouteWrite = Parameters<typeof db.editor.saveRoute>[0]
type CollectionWrite = Parameters<typeof db.editor.saveCollection>[0]
type QuestWrite = Parameters<typeof db.editor.saveQuest>[0]
type HubWrite = Parameters<typeof db.editor.saveCategory>[1]
type DraftWrite = Parameters<typeof db.editor.saveContentDraft>[0]

/** Classifies one entity and builds the gate. The split lives in `writingSplit`. */
export function contentGate(entity: WritingEntity, input: object, publishing: boolean): ContentGate {
  const split = writingSplit(entity, input as Record<string, unknown>)
  return {
    prose: split.prose,
    names: split.names,
    publishing,
    venue: entity === 'venue',
  }
}

export function contentWarnings(gate: ContentGate) {
  const prose = normalizeProse(writingCopy(gate.prose))
  const names = normalizeProse(writingCopy(gate.names ?? []))
  return writingGate({ prose, names, publishing: gate.publishing, venue: Boolean(gate.venue) })
}

async function afterPage(pageType: string, entityId: string | undefined) {
  if (entityId) {
    await syncPageSections(pageType, entityId)
  }
}

export async function savePlaceContent(input: PlaceWrite, userId: string | null | undefined, gate: ContentGate) {
  const writingWarnings = contentWarnings(gate)
  const row = await db.editor.savePlace(input, userId)
  await afterPage('place', row.id)
  return { row, writingWarnings }
}

export async function saveRouteContent(input: RouteWrite, userId: string | null | undefined, gate: ContentGate) {
  const writingWarnings = contentWarnings(gate)
  const row = await db.editor.saveRoute(input, userId)
  await afterPage('route', row.id)
  return { row, writingWarnings }
}

export async function saveCollectionContent(input: CollectionWrite, userId: string | null | undefined, gate: ContentGate) {
  const writingWarnings = contentWarnings(gate)
  const row = await db.editor.saveCollection(input, userId)
  await afterPage('collection', row.id)
  return { row, writingWarnings }
}

export async function saveQuestContent(input: QuestWrite, userId: string | null | undefined, gate: ContentGate) {
  const writingWarnings = contentWarnings(gate)
  const row = await db.editor.saveQuest(input, userId)
  await afterPage('quest', row.id)
  return { row, writingWarnings }
}

export async function saveHubContent(id: string, input: HubWrite, gate: ContentGate) {
  const writingWarnings = contentWarnings(gate)
  const row = await db.editor.saveCategory(id, input)
  await afterPage('hub', row?.id)
  return { row, writingWarnings }
}

export async function createVenueContent(input: VenueWrite, userId: string | null | undefined, gate: ContentGate) {
  const writingWarnings = contentWarnings(gate)
  const row = await db.venues.create(input, userId)
  await afterPage('venue', row.id)
  return { row, writingWarnings }
}

export async function updateVenueContent(id: string, input: VenueWrite, userId: string | null | undefined, gate: ContentGate) {
  const writingWarnings = contentWarnings(gate)
  const row = await db.venues.update(id, input, userId)
  await afterPage('venue', row?.id)
  return { row, writingWarnings }
}

export async function savePassportContent(input: PassportWrite, gate: ContentGate) {
  const writingWarnings = contentWarnings(gate)
  await db.scoring.upsertPassport(input)
  await afterPage(input.pageType, input.entityId)
  return { writingWarnings }
}

/** A pending draft does not change the live page, so section hashes stay. */
export async function savePendingDraftContent(input: DraftWrite, gate: ContentGate) {
  const writingWarnings = contentWarnings(gate)
  const row = await db.editor.saveContentDraft(input)
  return { row, writingWarnings }
}

export async function applyPendingPlaceContent(id: string, gate: ContentGate) {
  const writingWarnings = contentWarnings(gate)
  const row = await db.editor.applyPendingPlace(id)
  await afterPage('place', row?.id)
  return { row, writingWarnings }
}
