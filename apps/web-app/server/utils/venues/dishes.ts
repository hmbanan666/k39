import type { VenueModule } from '../../../shared/venue-modules'
import { db, priceInName, priceInNameMessage, VenueInputError } from '@k39/database'
import { dishLinks, dishPhotoProblem, stampDishModules } from '../../../shared/venue-modules'

/**
 * Assigns dish ids and price dates, then checks each photo.
 * An owner may attach only a photo they uploaded (origin `venue`).
 * An editor may attach only `own` or `commons`. An id that is already on
 * that dish is kept, so one side does not strip the other's photo.
 */
export async function normalizeDishModules(
  venueId: string | null,
  modules: VenueModule[],
  actor: 'owner' | 'editorial',
) {
  for (const mod of modules) {
    if (mod.type !== 'dishes') {
      continue
    }
    for (const item of mod.items) {
      if (priceInName(item.name)) {
        throw new VenueInputError(`${priceInNameMessage()}: ${item.name}`)
      }
    }
  }
  const current = venueId ? await db.venues.byId(venueId) : null
  const stamped = stampDishModules(modules, current?.modules ?? [])
  const links = dishLinks(stamped)
  if (!venueId && links.some((item) => item.mediaId)) {
    throw new VenueInputError('Сначала сохраните заведение, потом прикрепите фото блюда')
  }
  const gallery = venueId ? await db.venues.gallery(venueId) : []
  const problem = dishPhotoProblem(
    links,
    dishLinks(current?.modules),
    gallery.map((row) => ({ mediaId: row.media.id, origin: row.origin })),
    actor,
  )
  if (problem) {
    throw new VenueInputError(problem)
  }
  return stamped
}
