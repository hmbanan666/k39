import { loadVenuePath } from '../../utils/venues/public'

export default defineEventHandler(async (event) => {
  const path = String(getQuery(event).path || '/zavedeniya')
  const page = await loadVenuePath(path)
  if (!page) {
    throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
  }
  if (page.type === 'gone') {
    throw createError({ statusCode: 410, statusMessage: 'Gone' })
  }
  return page
})
