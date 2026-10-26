import { db } from '@k39/database'
import { requireEditor } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const [rows, pendingIds] = await Promise.all([db.editor.listPlaces(), db.editor.contentDraftEntityIds('place')])
  const pending = new Set(pendingIds)
  const phoneFacts = await db.facts.forConsumers(
    'place',
    rows.filter((row) => row.phone).map((row) => row.id),
    ['phone'],
  )
  const phoneSource = new Map(phoneFacts.map((fact) => [fact.consumerId, fact.sourceUrl]))
  return rows.map((row) => ({
    ...row,
    phoneSourceUrl: phoneSource.get(row.id) ?? null,
    pendingDraft: pending.has(row.id),
  }))
})
