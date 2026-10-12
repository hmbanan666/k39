import { requireEditor } from '../../utils/access'
import { listContentScores, refreshContentScores } from '../../utils/scoring/run'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  let rows = await listContentScores({})
  if (!rows.length) {
    await refreshContentScores({ force: true })
    rows = await listContentScores({})
  }
  return { rows }
})
