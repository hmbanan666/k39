import { z } from 'zod'
import { LENGTH_HARD_CAP, lengthJustificationValid } from '../../../shared/length-override'

export const pageKindSchema = z.enum(['place', 'route', 'collection', 'hub', 'quest', 'venue'])
export const primaryActionSchema = z.enum(['build_route', 'buy_ticket', 'go_next_place', 'claim_offer', 'read'])
export const scoreBlockSchema = z.enum(['quality', 'linking', 'indexing', 'results'])

export const lengthOverrideSchema = z.object({
  ceiling: z.number().int().min(1).max(LENGTH_HARD_CAP),
  queries: z.array(z.string().trim().min(1).max(160)).min(1).max(20),
  search: z.object({
    impressions: z.number().int().min(0).max(1_000_000_000),
    position: z.number().min(0).max(100),
  }).nullable().optional(),
  competitors: z.array(z.object({
    query: z.string().trim().min(1).max(160),
    chars: z.number().int().min(1).max(100_000),
  })).max(10).nullable().optional(),
  sections: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
}).strict().refine((value) => lengthJustificationValid(value), {
  message: 'Нужны запросы, показы с позицией или длины конкурентов, и список разделов',
})

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
  lengthOverride: lengthOverrideSchema.nullable().optional(),
})
