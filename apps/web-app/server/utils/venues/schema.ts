import { z } from 'zod'
import { venueModulesSchema } from '../../../shared/venue-modules'

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
  website: z.string().nullable().optional().describe('The venue\'s own site. Null clears it. A social host (vk.com, t.me, instagram, ok.ru, and the like) is rejected: put that link in socials'),
  socials: z.array(z.object({ network: z.string(), url: z.string() })).optional().describe('vk, telegram, instagram, whatsapp... with full URLs'),
  bookingUrl: z.string().nullable().optional().describe('Official table booking page. Null clears it'),
  orderUrl: z.string().nullable().optional().describe('Official online order or pickup page'),
  deliveryUrl: z.string().nullable().optional().describe('Official delivery page or the venue page on a delivery service'),
  menuUrl: z.string().nullable().optional().describe('Official menu page or PDF. Link only, never copy the menu'),
  reservation: z.enum(['yes', 'no', 'required', 'recommended']).nullable().optional().describe('Takes reservations, as the OSM reservation tag'),
  takeaway: z.boolean().nullable().optional(),
  delivery: z.boolean().nullable().optional(),
  signatureDishes: z.array(z.object({
    name: z.string(),
    note: z.string().nullable().optional(),
    priceRub: z.number().int().min(0).nullable().optional(),
  })).max(5).optional().describe('Up to 5 dishes worth ordering, in our own words, from a visit or the venue. Replaces the list'),
  modules: venueModulesSchema.optional().describe('Page modules, replaces the list. Types: text, dishes, audience, practical, best-time, how-to-get, tips, prices, faq. dishes is a showcase of at most 8 items {id?, name, description?, priceRub?, mediaId?, updatedAt?}. note on an item is the old short text. A new mediaId must already be attached with origin own or commons. See docs/venue-modules.md. Original text only'),
  contactEmail: z.string().nullable().optional().describe('Official venue email used for a claim code. Not shown on the public page'),
  description: z.string().optional().describe('Russian description, 300-600 characters to publish. Archive and SEO source when modules are set'),
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
