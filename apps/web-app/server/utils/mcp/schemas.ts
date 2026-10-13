import { z } from 'zod'

export const publication = z.enum(['draft', 'review', 'published']).optional()
export const visit = z.enum(['open', 'ruins', 'closed', 'unknown']).optional()
export const license = z.enum(['own', 'cc-by', 'cc-by-sa', 'cc0', 'pd', 'permission'])
export const sources = z.array(z.object({
  title: z.string(),
  url: z.string(),
})).optional()

export const orderedStop = z.object({
  placeSlug: z.string().describe('Slug of an existing place'),
  note: z.string().nullable().optional().describe('Optional short note shown with this stop'),
})

export const orderedStops = z.array(orderedStop).optional()

export const routePath = z.array(z.tuple([
  z.number().gte(-180).lte(180),
  z.number().gte(-90).lte(90),
])).min(2).max(5000).nullable().optional().describe('Real walked or driven line as [longitude, latitude] pairs. Omit to keep the current line. Null clears it. The map draws this line only when the route is selected.')

export const placeFields = {
  slug: z.string().optional().describe('URL slug, latin'),
  title: z.string().optional().describe('Visible Russian title'),
  categorySlug: z.string().optional().describe('Hub slug: forty, zamki, plyazhi, kurorty, muzei, eda'),
  regionSlug: z.string().optional().describe('Region slug from region_list, such as kaliningrad, gvardeysk, or zelenogradsk. Create one with region_upsert. Omit on update to keep the current region. Create does not default to kaliningrad.'),
  status: visit.describe('Visit status'),
  publicationStatus: publication.describe('draft, review, or published. Same values as the admin form'),
  summary: z.string().optional(),
  body: z.string().optional().describe('Markdown body'),
  hours: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  howToGet: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  ogImage: z.string().nullable().optional(),
  noindex: z.boolean().optional(),
  sources,
  factsCheckedAt: z.string().nullable().optional().describe('ISO date (YYYY-MM-DD or a full timestamp) when the facts were last checked. Stored as last_verified_at. Omit to keep the current value. Null clears it. Send it with only id or slug to record a check and leave the article unchanged.'),
}
