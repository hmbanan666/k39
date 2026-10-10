import { loadHub } from '../../../utils/public-pages'

export default defineEventHandler(async (event) => {
  const page = await loadHub(String(getRouterParam(event, 'slug')))
  if (!page) {
    throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
  }
  return page
})
