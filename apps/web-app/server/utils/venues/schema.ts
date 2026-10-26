import { priceInName, priceInNameMessage } from '@k39/database/price-label'
import { VK_COMMUNITY_ID_MAX } from '@k39/types/vk-community'
import { z } from 'zod'
import { venueModulesSchema } from '../../../shared/venue-modules'
import { sources } from '../mcp/schemas'

const point = z.number()
const day = z.object({
  weekday: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  closed: z.boolean().optional(),
  unknown: z
    .boolean()
    .optional()
    .describe('The source gives no hours for this day: «часы уточняйте», never «выходной» (ADR 0044)'),
  opens: z.string().nullable().optional(),
  closes: z.string().nullable().optional(),
})

export const venueFields = {
  slug: z.string().optional().describe('Latin slug. Omitted: built from the name'),
  name: z.string().optional().describe('Public name'),
  kind: z
    .string()
    .optional()
    .describe('cafe, restaurant, coffee, bar, bakery, market, fastfood, other, or a later token'),
  cuisineTags: z.array(z.string()).optional(),
  regionSlug: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Catalogue-area slug from region_list; may include surrounding settlements, not verified address locality. Null clears it',
    ),
  address: z.string().nullable().optional(),
  latitude: point.nullable().optional(),
  longitude: point.nullable().optional(),
  priceLevel: z.number().int().min(1).max(4).nullable().optional(),
  avgCheck: z.number().int().min(0).nullable().optional().describe('Average bill in rubles'),
  hours: z
    .object({
      days: z.array(day).optional(),
      note: z.string().nullable().optional(),
    })
    .optional()
    .describe(
      'A weekly table merged into the schedule (ADR 0028): days replace the week of its one season, note replaces the note (at most 200 characters). Omit days to keep the week. Closures, exceptions, holidays, and the source stay. days against a schedule with seasons, breaks, or another mode return 409; use schedule_set.',
    ),
  phone: z.string().nullable().optional(),
  website: z
    .string()
    .nullable()
    .optional()
    .describe(
      "The venue's own site. Null clears it. A social host (vk.com, vk.ru, t.me, instagram, ok.ru, whatsapp, x.com, and the like) is rejected: put that link in socials",
    ),
  socials: z
    .array(z.object({ network: z.string(), url: z.string() }))
    .optional()
    .describe('vk, telegram, instagram, whatsapp... with full URLs'),
  vkCommunityId: z
    .number()
    .int()
    .positive()
    .max(VK_COMMUNITY_ID_MAX)
    .nullable()
    .optional()
    .describe(
      "Numeric id of the VK community that socials link by screen name, from the venue's own album, photo, wall, or market URL (album-236300695_… is 236300695). Needs a VK link in socials. club, public, and event links already carry it. Never call the VK API for it. Null clears it. Omit to keep it",
    ),
  bookingUrl: z.string().nullable().optional().describe('Official table booking page. Null clears it'),
  orderUrl: z.string().nullable().optional().describe('Official online order or pickup page'),
  deliveryUrl: z
    .string()
    .nullable()
    .optional()
    .describe('Official delivery page or the venue page on a delivery service'),
  menuUrl: z.string().nullable().optional().describe('Official menu page or PDF. Link only, never copy the menu'),
  reservation: z
    .enum(['yes', 'no', 'required', 'recommended'])
    .nullable()
    .optional()
    .describe('Takes reservations, as the OSM reservation tag'),
  takeaway: z.boolean().nullable().optional(),
  delivery: z.boolean().nullable().optional(),
  signatureDishes: z
    .array(
      z.object({
        name: z.string().refine((value) => !priceInName(value), { message: priceInNameMessage() }),
        note: z.string().nullable().optional(),
        priceRub: z.number().int().min(0).nullable().optional(),
      }),
    )
    .max(5)
    .optional()
    .describe(
      'Up to 5 dishes worth ordering, in our own words, from a visit or the venue. The name is not a price: no ₽, no руб, and no rub. Replaces the list',
    ),
  modules: venueModulesSchema
    .optional()
    .describe(
      'Page modules, replaces the list. Types: text, dishes, audience, practical, best-time, how-to-get, tips, prices, faq. dishes is a showcase of at most 8 items {id?, name, description?, priceRub?, mediaId?, updatedAt?}. note on an item is the old short text. A new mediaId must already be attached with origin own or commons. See docs/venue-modules.md. Original text only',
    ),
  contactEmail: z
    .string()
    .nullable()
    .optional()
    .describe('Official venue email used for a claim code. Not shown on the public page'),
  description: z
    .string()
    .optional()
    .describe('Russian description, 300-600 characters to publish. Archive and SEO source when modules are set'),
  sources,
  status: z.enum(['draft', 'published', 'closed', 'archived']).optional(),
  lastVerifiedAt: z
    .string()
    .nullable()
    .optional()
    .describe('ISO date of the last check. Null clears it. Omit to keep it'),
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
