import { z } from 'zod'

const point = z.number()
const day = z.object({
  weekday: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  closed: z.boolean().optional(),
  opens: z.string().nullable().optional(),
  closes: z.string().nullable().optional(),
})

export const venueFields = {
  slug: z.string().optional().describe('Latin slug. Omitted: built from the name'),
  name: z.string().optional().describe('Public name'),
  kind: z.string().optional().describe('cafe, restaurant, coffee, bar, bakery, market, fastfood, other, or a later token'),
  cuisineTags: z.array(z.string()).optional(),
  regionSlug: z.string().nullable().optional().describe('Region slug from region_list. Null clears it'),
  address: z.string().nullable().optional(),
  latitude: point.nullable().optional(),
  longitude: point.nullable().optional(),
  priceLevel: z.number().int().min(1).max(4).nullable().optional(),
  avgCheck: z.number().int().min(0).nullable().optional().describe('Average bill in rubles'),
  hours: z.object({
    days: z.array(day).optional(),
    note: z.string().nullable().optional(),
  }).optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  socials: z.array(z.object({ network: z.string(), url: z.string() })).optional(),
  description: z.string().optional().describe('Russian description, 300-600 characters to publish'),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).optional(),
  status: z.enum(['draft', 'published', 'closed', 'archived']).optional(),
  lastVerifiedAt: z.string().nullable().optional().describe('ISO date of the last check. Null clears it. Omit to keep it'),
  osmId: z.string().nullable().optional(),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  noindex: z.boolean().optional(),
}

export const venueCreateSchema = {
  ...venueFields,
  name: z.string().describe('Public name'),
  kind: z.string().describe('cafe, restaurant, coffee, bar, bakery, market, fastfood, other, or a later token'),
}
