import { db } from '@k39/database'
import { requireEditor } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const rows = await db.venues.list()
  const regions = await db.editor.listRegions()
  const names = new Map(regions.map((row) => [row.id, row.title]))
  const pending = new Set(await db.editor.contentDraftEntityIds('venue'))
  return rows.map((row) => ({
    ...row,
    regionTitle: row.regionId ? names.get(row.regionId) ?? '' : '',
    pending: pending.has(row.id),
  }))
})
