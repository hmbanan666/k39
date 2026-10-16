import { db } from '@k39/database'
import { requireEditor } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const [rows, pendingIds] = await Promise.all([
    db.editor.listPlaces(),
    db.editor.contentDraftEntityIds('place'),
  ])
  const pending = new Set(pendingIds)
  return rows.map((row) => ({ ...row, pendingDraft: pending.has(row.id) }))
})
