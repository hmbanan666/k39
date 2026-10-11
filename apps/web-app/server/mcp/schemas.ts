import { z } from 'zod'

export const publication = z.enum(['draft', 'review', 'published']).optional()
export const visit = z.enum(['open', 'ruins', 'closed', 'unknown']).optional()
export const license = z.enum(['own', 'cc-by', 'cc-by-sa', 'cc0', 'pd', 'permission'])
export const sources = z.array(z.object({
  title: z.string(),
  url: z.string(),
})).optional()

export const placeFields = {
  slug: z.string().optional().describe('URL slug, latin'),
  title: z.string().optional().describe('Visible Russian title'),
  categorySlug: z.string().optional().describe('Hub slug: forty, zamki, plyazhi, kurorty, muzei, eda'),
  status: visit.describe('Visit status'),
  publicationStatus: publication.describe('draft or review. published is rejected'),
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
}
