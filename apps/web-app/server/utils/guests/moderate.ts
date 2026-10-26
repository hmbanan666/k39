import type { MediaLicense, MediaVariant } from '@k39/database'
import { db } from '@k39/database'
import { createError } from 'h3'
import { pageTraffic, priorityFor } from '../../../shared/facts'
import { guestByline, guestDateLabel, guestParts, guestReviewNodes, routeGuestDecision } from '../../../shared/guest'
import { toPublicMedia } from '../../../shared/media'
import { deleteMediaCompletely } from '../../media/ingest'

const LICENSES = new Set<MediaLicense>(['own', 'cc-by', 'cc-by-sa', 'cc0', 'pd', 'permission', 'guest'])

function asIso(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString()
  }
  return typeof value === 'string' ? value : ''
}

export async function loadGuestItems(subjectType: 'place' | 'venue', subjectId: string) {
  const rows = await db.guests.published(subjectType, subjectId)
  return rows.flatMap((row) => {
    const kind = row.kind === 'review' || row.kind === 'tip' || row.kind === 'photo' ? row.kind : null
    const acceptedAt = asIso(row.decided_at)
    if (!kind || !acceptedAt) {
      return []
    }
    const byline = guestByline(row.user_name)
    const body = kind === 'photo' ? '' : (row.body ?? '').trim()
    if (kind !== 'photo' && !body) {
      return []
    }
    const license = row.license && LICENSES.has(row.license as MediaLicense) ? (row.license as MediaLicense) : null
    const media =
      kind === 'photo' && row.media_id && row.filename
        ? {
            ...toPublicMedia({
              id: row.media_id,
              filename: row.filename,
              alt: row.alt || row.media_alt || '',
              caption: row.caption,
              author: byline,
              credit: null,
              license,
              sourceUrl: null,
              width: row.width,
              height: row.height,
              focalX: row.focal_x,
              focalY: row.focal_y,
              dominantColor: row.dominant_color,
              lqip: row.lqip,
              variants: Array.isArray(row.variants) ? (row.variants as MediaVariant[]) : [],
            }),
            author: byline,
            sourceUrl: null,
            license: 'guest' as const,
          }
        : null
    if (kind === 'photo' && !media) {
      return []
    }
    return [
      {
        id: row.id,
        kind,
        byline,
        acceptedAt,
        dateLabel: guestDateLabel(acceptedAt),
        body,
        parts: guestParts(body),
        alt: row.alt || row.media_alt || '',
        media,
      },
    ]
  })
}

export function attachGuestReviews(
  itemId: string,
  items: Array<{ kind: string; byline: string; body: string; acceptedAt: string }>,
  jsonLd: Array<Record<string, unknown>>,
) {
  for (const node of guestReviewNodes(itemId, items)) {
    jsonLd.push(node)
  }
}

async function subjectPath(subjectType: 'place' | 'venue', subjectId: string) {
  if (subjectType === 'place') {
    const place = await db.editor.placeById(subjectId)
    return place ? `/${place.slug}` : ''
  }
  const venue = await db.venues.byId(subjectId)
  return venue ? `/zavedeniya/${venue.slug}` : ''
}

export async function acceptGuest(id: string, actorId: string | null) {
  const row = await db.guests.byId(id)
  if (!row || row.status !== 'pending') {
    throw createError({ statusCode: 404, statusMessage: 'Запись уже решена.' })
  }
  if (row.kind === 'correction') {
    const path = await subjectPath(row.subjectType, row.subjectId)
    const traffic = path ? await db.facts.trafficForPath(path) : { pageviews: 0, impressions: 0 }
    const priority = priorityFor('prose', 'guest_report', pageTraffic(traffic.pageviews, traffic.impressions))
    await db.guests.signalCorrection({
      submissionId: row.id,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      correctionKind: row.correctionKind || 'other',
      value: row.correctionValue || '',
      note: row.body || '',
      url: row.sourceUrl,
      priority,
    })
  }
  const updated = await db.guests.decide(id, actorId, 'accepted', null)
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Запись уже решена.' })
  }
  return { id: updated.id, status: updated.status }
}

export async function rejectGuest(id: string, actorId: string | null, note: string) {
  const reason = note.trim()
  if (!reason || reason.length > 500) {
    throw createError({ statusCode: 400, statusMessage: 'Напишите причину для автора, до 500 знаков.' })
  }
  const row = await db.guests.byId(id)
  if (!row || row.status !== 'pending') {
    throw createError({ statusCode: 404, statusMessage: 'Запись уже решена.' })
  }
  const mediaId = row.mediaId
  const updated = await db.guests.decide(id, actorId, 'rejected', reason)
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Запись уже решена.' })
  }
  if (mediaId) {
    await deleteMediaCompletely(mediaId)
  }
  return { id: updated.id, status: updated.status }
}

export async function moderateGuest(input: {
  id: string
  actorId: string | null
  decision: 'accept' | 'reject' | 'dispute'
  note?: string
  recognizableFace?: boolean
}) {
  const current = input.decision === 'accept' ? await db.guests.byId(input.id) : null
  const routed = routeGuestDecision({
    kind: current?.kind ?? null,
    decision: input.decision,
    recognizableFace: input.recognizableFace,
    note: input.note,
  })
  if (routed.decision === 'dispute') {
    return disputeGuest(input.id, input.actorId)
  }
  if (routed.decision === 'reject') {
    return rejectGuest(input.id, input.actorId, routed.note ?? '')
  }
  return acceptGuest(input.id, input.actorId)
}

export async function disputeGuest(id: string, actorId: string | null) {
  const row = await db.guests.flagDispute(id, actorId)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Запись уже решена.' })
  }
  return { id: row.id, disputed: true }
}

export async function dismissGuestSignal(id: string) {
  const row = await db.facts.queueById(id)
  if (!row || row.resolvedAt || row.reason !== 'guest_report' || row.target !== 'section') {
    throw createError({ statusCode: 404, statusMessage: 'Сигнал уже закрыт.' })
  }
  await db.facts.close(id)
  return { id }
}

export async function removeGuestMedia(mediaIds: Array<string | null>) {
  for (const id of mediaIds) {
    if (id) {
      await deleteMediaCompletely(id)
    }
  }
}

export async function listPendingGuestRows() {
  const rows = presentPending(await db.guests.pendingQueue())
  const mediaRows = await db.content.mediaByIds(rows.flatMap((row) => (row.mediaId ? [row.mediaId] : [])))
  const mediaById = new Map(mediaRows.map((row) => [row.id, row]))
  return rows.map((row) => {
    const media = row.mediaId ? mediaById.get(row.mediaId) : undefined
    return {
      ...row,
      mediaSrc: media ? toPublicMedia(media).src : null,
    }
  })
}

export function presentPending(rows: Awaited<ReturnType<typeof db.guests.pendingQueue>>) {
  return rows.map((row) => {
    const subjectTitle = row.placeTitle || row.venueName || 'Страница'
    const subjectPath = row.placeSlug ? `/${row.placeSlug}` : row.venueSlug ? `/zavedeniya/${row.venueSlug}` : ''
    return {
      id: row.id,
      createdAt: row.createdAt,
      kind: row.kind,
      body: row.body ?? '',
      alt: row.alt ?? '',
      correctionKind: row.correctionKind,
      correctionValue: row.correctionValue ?? '',
      sourceUrl: row.sourceUrl,
      disputed: row.disputed,
      mediaId: row.mediaId,
      byline: guestByline(row.userName),
      subjectTitle,
      subjectPath,
    }
  })
}
