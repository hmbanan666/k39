import { loadPlace } from '../../../utils/public-pages'

export default defineEventHandler(async (event) => {
  const pageQuery = Number(getQuery(event).page ?? 1)
  const page = await loadPlace(String(getRouterParam(event, 'slug')), Number.isFinite(pageQuery) ? pageQuery : 1)
  if (!page) {
    throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
  }
  return page
})
