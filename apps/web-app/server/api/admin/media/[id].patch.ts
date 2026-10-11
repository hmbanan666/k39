import type { MediaLicense } from '@k39/database'
import { db } from '@k39/database'
import { requireEditor } from '../../../utils/access'

const LICENSES = new Set(['own', 'cc-by', 'cc-by-sa', 'cc0', 'pd', 'permission'])

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const id = String(getRouterParam(event, 'id') || '')
  const body = await readBody<Record<string, unknown>>(event)
  const current = await db.editor.mediaById(id)
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Фото не найдено' })
  }
  const licenseRaw = typeof body.license === 'string' ? body.license : undefined
  if (licenseRaw !== undefined && licenseRaw !== '' && !LICENSES.has(licenseRaw)) {
    throw createError({ statusCode: 400, statusMessage: 'Неизвестная лицензия' })
  }
  const focalX = numberOrUndefined(body.focalX)
  const focalY = numberOrUndefined(body.focalY)
  if ((focalX !== undefined && (focalX < 0 || focalX > 1)) || (focalY !== undefined && (focalY < 0 || focalY > 1))) {
    throw createError({ statusCode: 400, statusMessage: 'Точка кадра от 0 до 1' })
  }
  const alt = typeof body.alt === 'string' ? body.alt.trim() : undefined
  if (alt !== undefined && !alt) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен alt' })
  }
  const updated = await db.editor.updateMedia(id, {
    alt,
    author: typeof body.author === 'string' ? body.author : undefined,
    caption: typeof body.caption === 'string' ? body.caption : undefined,
    sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
    license: licenseRaw === '' ? null : licenseRaw as MediaLicense | undefined,
    focalX,
    focalY,
  })
  const placeId = typeof body.placeId === 'string' ? body.placeId : ''
  if (placeId && body.isCover === true) {
    await db.editor.attachMedia(placeId, id, { isCover: true })
    await db.editor.setCover(placeId, id)
  }
  if (placeId && Array.isArray(body.order)) {
    await db.editor.reorderGallery(placeId, body.order.filter((item): item is string => typeof item === 'string'))
  }
  return updated
})

function numberOrUndefined(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined
  }
  return value
}
