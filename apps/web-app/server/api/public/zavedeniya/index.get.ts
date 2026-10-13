import { loadVenueListing } from '../../../utils/venues/pages'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const region = typeof query.region === 'string' ? query.region : undefined
  const kind = typeof query.kind === 'string' ? query.kind : undefined
  const page = await loadVenueListing(region, kind)
  if (!page) {
    throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
  }
  return { kind: 'listing' as const, page }
})
