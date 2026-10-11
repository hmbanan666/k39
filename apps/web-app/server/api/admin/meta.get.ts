import { db } from '@k39/database'
import { requireEditor } from '../../utils/access'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  return {
    categories: await db.content.categories(),
    regions: await db.editor.listRegions(),
  }
})
