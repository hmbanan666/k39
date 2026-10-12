import { db } from '@k39/database'
import { createError } from 'h3'
import { slugError } from '../../../shared/seo'
import { auditMcp } from './audit'

export interface RegionCenter {
  latitude: number
  longitude: number
}

export interface RegionRow {
  id: string
  slug: string
  title: string
  description: string | null
  latitude: number | null
  longitude: number | null
}

// coordinates and center are the same optional point. Null clears both columns.
// Omitting both leaves the stored center alone.
export function resolveCenter(input: {
  coordinates?: RegionCenter | null
  center?: RegionCenter | null
}): { latitude: number | null, longitude: number | null } | undefined {
  if (input.coordinates !== undefined && input.center !== undefined) {
    const left = input.coordinates
    const right = input.center
    const same = (left === null && right === null)
      || (left !== null && right !== null && left.latitude === right.latitude && left.longitude === right.longitude)
    if (!same) {
      throw createError({ statusCode: 400, statusMessage: 'coordinates и center должны совпадать' })
    }
  }
  const point = input.center !== undefined ? input.center : input.coordinates
  if (point === undefined) {
    return undefined
  }
  if (point === null) {
    return { latitude: null, longitude: null }
  }
  if (point.latitude < -90 || point.latitude > 90 || point.longitude < -180 || point.longitude > 180) {
    throw createError({ statusCode: 400, statusMessage: 'Координаты вне диапазона' })
  }
  return { latitude: point.latitude, longitude: point.longitude }
}

export function regionView(row: RegionRow) {
  const center = row.latitude != null && row.longitude != null
    ? { latitude: row.latitude, longitude: row.longitude }
    : null
  return {
    id: row.id,
    slug: row.slug,
    name: row.title,
    title: row.title,
    description: row.description,
    center,
    coordinates: center,
  }
}

export async function listRegions() {
  const rows = await db.editor.listRegions()
  return rows.map((row) => regionView(row))
}

export async function upsertRegion(input: {
  slug: string
  name: string
  description?: string | null
  coordinates?: RegionCenter | null
  center?: RegionCenter | null
}) {
  const problem = slugError(input.slug)
  if (problem) {
    throw createError({ statusCode: 400, statusMessage: problem })
  }
  const name = input.name.trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Нужно название' })
  }
  const center = resolveCenter(input)
  const row = await db.editor.upsertRegion({
    slug: input.slug,
    title: name,
    description: input.description,
    latitude: center?.latitude,
    longitude: center?.longitude,
  })
  await auditMcp('region_upsert', 'region', row.id)
  return regionView(row)
}
