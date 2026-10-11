import { db } from '@k39/database'
import { searchCommons } from '../../media/commons'
import { requireEditor } from '../../utils/access'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const query = getQuery(event)
  const placeId = String(query.placeId || '')
  const place = placeId ? await db.editor.placeById(placeId) : null
  const lat = numberOrNull(query.lat) ?? place?.latitude ?? null
  const lng = numberOrNull(query.lng) ?? place?.longitude ?? null
  const title = String(query.q || place?.title || '')
  const hits = await searchCommons({ lat, lng, title })
  return { hits }
})

function numberOrNull(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
