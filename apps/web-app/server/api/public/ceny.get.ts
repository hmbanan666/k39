import { loadPriceListing } from '../../utils/venues/price-page'

export default defineEventHandler(async (event) => {
  const item = String(getQuery(event).item || '')
  const region = String(getQuery(event).region || '').trim()
  const page = await loadPriceListing(item, region || null)
  if (!page) {
    throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
  }
  return page
})
