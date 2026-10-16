import { requireEditor } from '../../utils/access'
import { ownerConflictRows, withTrust } from '../../utils/facts/trust'
import { withPagePersonas } from '../../utils/scoring/personas'
import { listContentScores, refreshContentScores } from '../../utils/scoring/run'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  let rows = await listContentScores({})
  if (!rows.length) {
    await refreshContentScores({ force: true })
    rows = await listContentScores({})
  }
  return {
    rows: await withTrust(await withPagePersonas(rows)),
    conflicts: await ownerConflictRows(),
  }
})
