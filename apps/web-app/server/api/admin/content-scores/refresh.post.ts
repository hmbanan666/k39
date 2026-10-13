import { requireEditor } from '../../../utils/access'
import { withPagePersonas } from '../../../utils/scoring/personas'
import { listContentScores, refreshContentScores } from '../../../utils/scoring/run'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const result = await refreshContentScores({ force: true })
  const rows = await listContentScores({})
  return { ...result, rows: await withPagePersonas(rows) }
})
