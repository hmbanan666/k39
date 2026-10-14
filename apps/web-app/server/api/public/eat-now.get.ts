import { loadEatNow } from '../../utils/venues/public'

export default defineEventHandler(async (event) => {
  const region = String(getQuery(event).region || '').trim()
  const page = await loadEatNow(region || null)
  if (!page) {
    throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
  }
  return page
})
