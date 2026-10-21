import { db } from '@k39/database'
import { requireEditor } from '../../../utils/access'
import { attachDraftNotices } from '../../../utils/admin/content-draft'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  return attachDraftNotices('collection', await db.editor.listCollections())
})
