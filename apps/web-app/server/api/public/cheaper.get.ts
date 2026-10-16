import { loadCheaperCity, loadCheaperIndex } from '../../utils/venues/price-page'

export default defineEventHandler(async (event) => {
  const region = String(getQuery(event).region || '').trim()
  if (!region) {
    return loadCheaperIndex()
  }
  const page = await loadCheaperCity(region)
  if (!page) {
    throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
  }
  return page
})
