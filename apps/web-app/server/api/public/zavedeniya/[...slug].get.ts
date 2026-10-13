import { venueKindBySlug } from '../../../../shared/venues'
import { loadVenue, loadVenueListing } from '../../../utils/venues/pages'

export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, 'slug') || ''
  const parts = raw.split('/').filter(Boolean)
  if (parts.length === 1) {
    const [slug] = parts
    const listing = await loadVenueListing(slug)
    if (listing) {
      return { kind: 'listing' as const, page: listing }
    }
    const venue = await loadVenue(slug!)
    if (venue?.gone) {
      throw createError({ statusCode: 410, statusMessage: 'Gone' })
    }
    if (!venue) {
      throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
    }
    return { kind: 'venue' as const, page: venue }
  }
  if (parts.length === 2) {
    if (!venueKindBySlug(parts[1] || '')) {
      throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
    }
    const listing = await loadVenueListing(parts[0], parts[1])
    if (!listing) {
      throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
    }
    return { kind: 'listing' as const, page: listing }
  }
  throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
})
