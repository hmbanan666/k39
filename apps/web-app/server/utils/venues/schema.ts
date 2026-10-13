import { z } from 'zod'

const interval = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
})

const day = z.array(interval).max(4).nullable()

export const venueHoursSchema = z.object({
  mon: day.optional(),
  tue: day.optional(),
  wed: day.optional(),
  thu: day.optional(),
  fri: day.optional(),
  sat: day.optional(),
  sun: day.optional(),
  note: z.string().max(300).nullable().optional(),
})

export const venueKindSchema = z.enum(['cafe', 'restaurant', 'coffee', 'bar', 'bakery', 'market', 'fastfood', 'other'])

export const venueStatusSchema = z.enum(['draft', 'published', 'closed', 'archived'])

export const venueFields = {
  slug: z.string().optional(),
  name: z.string().max(200).optional(),
  kind: venueKindSchema.optional(),
  cuisine: z.array(z.string().max(40)).max(12).optional(),
  regionSlug: z.string().nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  priceLevel: z.number().int().min(1).max(4).nullable().optional(),
  avgCheck: z.number().int().min(0).max(1_000_000).nullable().optional(),
  hours: venueHoursSchema.nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  website: z.string().max(300).nullable().optional(),
  socials: z.object({
    instagram: z.string().max(200).nullable().optional(),
    vk: z.string().max(200).nullable().optional(),
    telegram: z.string().max(200).nullable().optional(),
  }).optional(),
  description: z.string().max(600).optional(),
  sources: z.array(z.object({
    title: z.string().max(200),
    url: z.string().max(500),
  })).max(20).optional(),
  status: venueStatusSchema.optional(),
  lastVerifiedAt: z.string().nullable().optional(),
  osmId: z.string().max(40).nullable().optional(),
  seoTitle: z.string().max(120).nullable().optional(),
  seoDescription: z.string().max(200).nullable().optional(),
  mediaIds: z.array(z.string()).max(24).optional(),
}
