import { z } from 'zod'

export const pageKindSchema = z.enum(['place', 'route', 'collection', 'hub', 'quest', 'venue'])
export const primaryActionSchema = z.enum(['build_route', 'buy_ticket', 'go_next_place', 'claim_offer', 'read'])
export const scoreBlockSchema = z.enum(['quality', 'linking', 'indexing', 'results'])

export const passportWriteSchema = z.object({
  path: z.string().optional(),
  pageType: pageKindSchema.optional(),
  slug: z.string().optional(),
  targetQueries: z.array(z.string().trim().min(1).max(160)).max(20).optional(),
  audience: z.string().trim().max(500).nullable().optional(),
  primaryAction: primaryActionSchema.nullable().optional(),
  goal30d: z.number().int().min(0).max(1_000_000).nullable().optional(),
  goal90d: z.number().int().min(0).max(1_000_000).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
})
