import { db } from '@k39/database'
import { requireEditor } from '../../utils/access'
import { personaCoverageReport } from '../../utils/scoring/coverage'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const [catalog, stored] = await Promise.all([db.scoring.loadCatalog(), db.scoring.listPagePersonas()])
  return personaCoverageReport(catalog, stored)
})
