import type { H3Event } from 'h3'
import type { NoticeSubjectType } from '../../../shared/notices'
import type { PlaceDraftNotice } from '../../../shared/place-draft-diff'
import { db } from '@k39/database'
import { createError, getRouterParam } from 'h3'
import { NOTICE_SUBJECT_TYPES } from '../../../shared/notices'
import { formatDraftUpdated } from '../../../shared/place-draft-diff'
import { requireEditor, withContentScope } from '../access'
import { setPublication } from '../mcp/publish'
import { noticeDraftChange, noticesView, noticeTarget } from './write'

/** The admin subject from `/api/admin/notices/{type}/{id}`. Editors only. */
export async function adminNoticeTarget(event: H3Event) {
  await requireEditor(event)
  const type = getRouterParam(event, 'type') as NoticeSubjectType
  if (!NOTICE_SUBJECT_TYPES.includes(type)) {
    throw createError({ statusCode: 404, statusMessage: 'Неизвестный тип' })
  }
  return noticeTarget(type, getRouterParam(event, 'id'))
}

/**
 * The editor's view: live rows, and whether a pending draft exists. A place
 * shows its draft, notices included, in the form above. A venue has no other
 * draft UI, so its staged list comes back here as a diff.
 */
export async function adminNoticesView(target: Awaited<ReturnType<typeof adminNoticeTarget>>) {
  const [view, draft] = await Promise.all([
    noticesView(target),
    db.editor.contentDraft(target.type, target.id),
  ])
  let pending: PlaceDraftNotice | null = null
  if (draft && target.type === 'venue') {
    pending = {
      updatedAt: draft.updatedAt,
      updatedLabel: formatDraftUpdated(draft.updatedAt),
      publicationStatus: draft.publicationStatus,
      noticesOnly: true,
      changes: await noticeDraftChange(target, draft.payload),
    }
  }
  return {
    target: { type: target.type, id: target.id, slug: target.slug, status: target.status },
    notices: view.notices,
    hasDraft: Boolean(draft),
    pending,
  }
}

/** Apply or discard a venue's staged notices. A place uses its own draft route. */
export async function decideVenueNoticeDraft(target: Awaited<ReturnType<typeof adminNoticeTarget>>, action: unknown) {
  if (target.type !== 'venue') {
    throw createError({ statusCode: 400, statusMessage: 'Черновик места применяется в форме места' })
  }
  if (action === 'apply') {
    return withContentScope('editor', () => setPublication({ entity: 'venue', id: target.id, publicationStatus: 'published' }))
  }
  if (action === 'discard') {
    if (!await db.editor.contentDraft('venue', target.id)) {
      throw createError({ statusCode: 409, statusMessage: 'Черновика нет' })
    }
    await db.editor.deleteContentDraft('venue', target.id)
    return { discarded: true as const }
  }
  throw createError({ statusCode: 400, statusMessage: 'Нужно действие: применить или отбросить' })
}
