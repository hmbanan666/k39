import { prepareSourceLinks, SOURCE_LINK_LIMIT, SourceInputError, sourceLimitMessage } from '@k39/database'
import { z } from 'zod'

export const publication = z.enum(['draft', 'review', 'published']).optional()
export const visit = z.enum(['open', 'ruins', 'closed', 'unknown']).optional()
export const license = z.enum(['own', 'cc-by', 'cc-by-sa', 'cc0', 'pd', 'permission'])

const sourceLink = z.object({
  title: z.string(),
  url: z.string(),
})

/**
 * Shared by places, collections, and venues.
 * Rows are checked, then duplicate URLs merge, then `.max` counts what remains.
 */
export const sources = z.array(sourceLink)
  .superRefine((rows, ctx) => {
    try {
      prepareSourceLinks(rows)
    } catch (error) {
      if (error instanceof SourceInputError) {
        ctx.addIssue({ code: 'custom', message: error.message })
        return
      }
      throw error
    }
  })
  .transform((rows) => prepareSourceLinks(rows) ?? [])
  .pipe(z.array(sourceLink).max(SOURCE_LINK_LIMIT, sourceLimitMessage()))
  .optional()
  .describe(`Up to ${SOURCE_LINK_LIMIT} sources. Duplicate URLs merge (trailing slash, www, and http/https) before the limit. Each row needs a title and an http(s) URL.`)

export const orderedStop = z.object({
  placeSlug: z.string().describe('Slug of an existing place'),
  note: z.string().nullable().optional().describe('Optional short note shown with this stop'),
})

export const orderedStops = z.array(orderedStop).optional()

export const routePath = z.array(z.tuple([
  z.number().gte(-180).lte(180),
  z.number().gte(-90).lte(90),
])).min(2).max(5000).nullable().optional().describe('Real walked or driven line as [longitude, latitude] pairs. Omit to keep the current line. Null clears it. The map draws this line only when the route is selected.')

export const bodySections = z.array(z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), title: z.string().trim().min(1).max(120).optional(), text: z.string() }),
  z.object({ kind: z.literal('useful'), text: z.string() }),
  z.object({ kind: z.literal('directions'), text: z.string() }),
])).max(30).optional().describe('Typed body sections (ADR 0027), in page order. kind text carries its own title (История, Что посмотреть, ...); an untitled text section is the intro. kind useful renders as «Полезно знать» and directions as «Как добраться»: never put those headings in text. Replaces the body when sent; the markdown body is then composed from the sections. Omit to keep.')

export const placeFields = {
  slug: z.string().optional().describe('URL slug, latin'),
  title: z.string().optional().describe('Visible Russian title'),
  categorySlug: z.string().optional().describe('Hub slug: forty, zamki, plyazhi, kurorty, muzei, eda'),
  regionSlug: z.string().optional().describe('Region slug from region_list, such as kaliningrad, gvardeysk, or zelenogradsk. Create one with region_upsert. Omit on update to keep the current region. Create does not default to kaliningrad.'),
  status: visit.describe('Visit status'),
  publicationStatus: publication.describe('draft, review, or published. Same values as the admin form'),
  summary: z.string().optional(),
  body: z.string().optional().describe('Markdown body. Split into sections on its ## headings when saved; prefer sections for edits'),
  sections: bodySections,
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
  visitDuration: z.string().max(80).nullable().optional().describe('How long a visit takes, Russian, short: "1–2 часа". Shown in the answer block. Must come from a source or a measured route. Null clears it.'),
  bestTime: z.string().max(160).nullable().optional().describe('Best time to come, Russian, short: "май–сентябрь, утром". Shown in the answer block. Null clears it.'),
  faq: z.array(z.object({
    question: z.string().min(5).max(200),
    answer: z.string().min(5).max(1200),
  })).max(8).optional().describe('3 to 6 real visitor questions answered only from sourced facts. Plain text answers. Renders the FAQ block and FAQPage markup. An empty array removes the block. Omit to keep.'),
  factsCheckedAt: z.string().nullable().optional().describe('ISO date (YYYY-MM-DD or a full timestamp) when the facts were last checked. Stored as last_verified_at. Omit to keep the current value. Null clears it. Send it with only id or slug to record a check and leave the article unchanged.'),
}
