import { parseMapQuery as parseEmbedQuery } from '../../../shared/embed-map'
import { loadMap as loadEmbed } from '../../utils/map/load'
import { loadMap as loadCatalog } from '../../utils/map/public'

function one(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw : ''
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const scoped = one(query.scope) || one(query.lat) || one(query.lng) || one(query.route) || one(query.radius)
  if (scoped) {
    return loadEmbed(parseEmbedQuery({
      scope: one(query.scope),
      lat: one(query.lat),
      lng: one(query.lng),
      route: one(query.route),
      radius: one(query.radius),
    }))
  }
  return loadCatalog()
})
