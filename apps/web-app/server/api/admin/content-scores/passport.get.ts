import { requireEditor } from '../../../utils/access'
import { readPassport, resolveScoredPage } from '../../../utils/scoring/run'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const query = getQuery(event)
  const path = typeof query.path === 'string' ? query.path : ''
  const page = await resolveScoredPage({ path })
  if (!page) {
    throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
  }
  return readPassport(page)
})
