import { parseMapQuery } from '../../../shared/map'
import { loadMap } from '../../utils/map/load'

function one(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw : ''
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  return loadMap(parseMapQuery({
    scope: one(query.scope),
    lat: one(query.lat),
    lng: one(query.lng),
    route: one(query.route),
    radius: one(query.radius),
  }))
})
