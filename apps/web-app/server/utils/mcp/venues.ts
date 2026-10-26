import { isStale } from '@k39/database'
import { z } from 'zod'

const venueListShape = {
  regionSlug: z.string().optional().describe('Region slug. Unknown slug is a 400.'),
  kind: z.string().optional().describe('Venue kind, such as cafe or restaurant.'),
  status: z.enum(['draft', 'published', 'closed', 'archived']).optional(),
  stale: z.boolean().optional().describe('True: lastVerifiedAt missing or older than 180 days.'),
  near: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      radiusKm: z.number().positive().max(100),
    })
    .optional(),
  query: z.string().trim().min(1).max(100).optional().describe('Name or slug. Lower case, ё and е match.'),
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('1-based page. The offset is (page - 1) * pageSize. There is no offset argument.'),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Page size. Default 20, maximum 50. There is no limit argument.'),
}

export const venuesListInput = z.strictObject(venueListShape)

export type VenuesListInput = z.infer<typeof venuesListInput>

export const venueDuplicatesInput = z
  .strictObject({
    name: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .optional()
      .describe('Compared ignoring case, ё/е, quotes, and a kind word such as кафе or ресторан.'),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    radiusM: z.number().int().min(1).max(2000).optional().describe('Metres. Default 150, maximum 2000.'),
    regionSlug: z.string().optional().describe('When set, only venues in this region.'),
  })
  .refine((value) => Boolean(value.name) || (value.latitude != null && value.longitude != null), {
    message: 'Передайте название или координаты',
  })
  .refine((value) => (value.latitude == null) === (value.longitude == null), {
    message: 'Широта и долгота задаются вместе',
  })

export type VenueDuplicatesInput = z.infer<typeof venueDuplicatesInput>

export interface VenueListRow {
  id: string
  slug: string
  name: string
  kind: string
  status: string
  regionId: string | null
  latitude: number | null
  longitude: number | null
  lastVerifiedAt: string | null
  priceBand: 'low' | 'mid' | 'high' | null
  priceBandComputedAt: string | null
  priceBandBasis: number | null
  osmId: string | null
  distanceKm: number | null
  createdAt: string
  updatedAt: string
}

export function venueListItem(row: VenueListRow, now = new Date()) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    status: row.status,
    regionId: row.regionId,
    latitude: row.latitude,
    longitude: row.longitude,
    lastVerifiedAt: row.lastVerifiedAt,
    priceBand: row.priceBand,
    priceBandComputedAt: row.priceBandComputedAt,
    priceBandBasis: row.priceBandBasis,
    stale: isStale(row.lastVerifiedAt, now),
    distanceKm: row.distanceKm,
    osmId: row.osmId,
  }
}

export function venueListResult(rows: VenueListRow[], total: number, page: number, pageSize: number, now = new Date()) {
  return {
    items: rows.map((row) => venueListItem(row, now)),
    total,
    page,
    pageSize,
  }
}
