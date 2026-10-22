import { db } from '@k39/database'
import { createError } from 'h3'
import { syncSavedPage } from './save'

type EditorTx = NonNullable<Parameters<typeof db.editor.saveCollection>[2]>

export type DraftEntity = 'place' | 'collection' | 'route'

/**
 * Live row plus the gate warnings. `draftDropped` stays false until
 * `withEditorLiveWrite` replaces it with the checked-draft result.
 */
export function liveWriteRow<T extends { id: string }>(row: T, writingWarnings: string[]) {
  return { ...row, writingWarnings, draftDropped: false as const }
}

/**
 * Runs `write` and, when `stamp` is set, deletes that draft only if it is
 * still the row the caller checked. One transaction, so a newer draft stays.
 */
async function runWithCheckedDraft<T>(
  stamp: { id: string, updatedAt: string } | null,
  write: (tx: EditorTx) => Promise<T>,
) {
  return db.editor.transaction(async (tx) => {
    const result = await write(tx)
    const draftDropped = stamp
      ? await db.editor.deleteContentDraftIfUnchanged(stamp.id, stamp.updatedAt, tx)
      : false
    return { result, draftDropped }
  })
}

/**
 * A pending draft blocks an admin save until the body sets `pendingDraft`
 * to `discard`. The discard deletes only the draft that was checked, in the
 * same transaction as the save, so a newer draft written in between stays.
 * One guard for a place, a route, and a collection.
 */
export async function withPendingGuard<T extends { id: string }>(
  entity: DraftEntity,
  id: string,
  pendingDraft: unknown,
  write: (tx: EditorTx) => Promise<T>,
) {
  const pending = await db.editor.contentDraft(entity, id)
  if (pending && pendingDraft !== 'discard') {
    throw createError({ statusCode: 409, statusMessage: 'Есть черновик. Примените его или отбросьте.' })
  }
  const stamp = pending && pendingDraft === 'discard'
    ? { id: pending.id, updatedAt: pending.updatedAt }
    : null
  const { result } = await runWithCheckedDraft(stamp, write)
  await syncSavedPage(entity, result.id)
  return result
}

/**
 * Editor live write (ADR 0035, ADR 0041). The pending draft this call saw
 * is deleted in the same transaction when it is still that row. A newer
 * draft stays. `draftDropped` is true only when the checked draft was removed.
 */
export async function withEditorLiveWrite<T extends { id: string }>(
  entity: DraftEntity,
  id: string,
  write: (tx: EditorTx) => Promise<T>,
) {
  const pending = await db.editor.contentDraft(entity, id)
  const stamp = pending ? { id: pending.id, updatedAt: pending.updatedAt } : null
  const { result, draftDropped } = await runWithCheckedDraft(stamp, write)
  await syncSavedPage(entity, result.id)
  return { ...result, draftDropped }
}
