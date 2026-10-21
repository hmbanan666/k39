import { z } from 'zod'
import { venueModulesSchema } from './venue-modules'

/** Columns an owner may change. Status, slug, pin, and SEO stay with the desk (ADR 0031). */
export const OWNER_FIELDS = [
  'name',
  'description',
  'cuisineTags',
  'address',
  'phone',
  'website',
  'socials',
  'bookingUrl',
  'orderUrl',
  'deliveryUrl',
  'menuUrl',
  'reservation',
  'takeaway',
  'delivery',
  'signatureDishes',
  'priceLevel',
  'avgCheck',
  'modules',
  'hours',
] as const

export type OwnerField = (typeof OWNER_FIELDS)[number]

const emptyToNull = z.union([z.string(), z.null()]).optional().transform((value) => {
  if (value == null) {
    return null
  }
  const trimmed = value.trim()
  return trimmed || null
})

const day = z.object({
  weekday: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  closed: z.boolean().optional(),
  /** Hours for this day are unknown (ADR 0044): kept, never turned into a day off. */
  unknown: z.boolean().optional(),
  opens: z.string().nullable().optional(),
  closes: z.string().nullable().optional(),
})

export const ownerVenueSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().max(8000).optional(),
  cuisineTags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  address: emptyToNull,
  phone: emptyToNull,
  website: emptyToNull,
  socials: z.array(z.object({
    network: z.string().trim().min(1).max(24),
    url: z.string().trim().min(1).max(300),
  })).max(8).optional(),
  bookingUrl: emptyToNull,
  orderUrl: emptyToNull,
  deliveryUrl: emptyToNull,
  menuUrl: emptyToNull,
  reservation: z.enum(['yes', 'no', 'required', 'recommended']).nullable().optional(),
  takeaway: z.boolean().nullable().optional(),
  delivery: z.boolean().nullable().optional(),
  signatureDishes: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    note: z.string().trim().max(160).nullable().optional(),
    priceRub: z.number().int().min(0).max(1_000_000).nullable().optional(),
  })).max(5).optional(),
  priceLevel: z.number().int().min(1).max(4).nullable().optional(),
  avgCheck: z.number().int().min(0).max(1_000_000).nullable().optional(),
  modules: venueModulesSchema.optional(),
  hours: z.object({
    days: z.array(day).max(7).optional(),
    note: z.string().trim().max(200).nullable().optional(),
  }).optional(),
}).strict()

export type OwnerVenueInput = z.infer<typeof ownerVenueSchema>

export function venueClaimPath(slug: string) {
  return `/kabinet/zayavka/${encodeURIComponent(slug)}`
}

export function pickOwnerFields(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const key of OWNER_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      out[key] = input[key]
    }
  }
  return out
}

export function maskEmail(email: string | null | undefined) {
  if (!email || !email.includes('@')) {
    return null
  }
  const [name, domain] = email.split('@')
  if (!name || !domain) {
    return null
  }
  const head = name.slice(0, 1)
  return `${head}***@${domain}`
}

export function maskPhone(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 10) {
    return null
  }
  return `***${digits.slice(-2)}`
}

export function phoneCanReceiveCode(phone: string | null | undefined) {
  return (phone ?? '').replace(/\D/g, '').length >= 10
}

export function emailCanReceiveCode(email: string | null | undefined) {
  return Boolean(email && /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email))
}

export interface ClaimChannelPlan {
  email: { present: boolean, transport: boolean, mask: string | null }
  phone: { present: boolean, transport: boolean, mask: string | null }
}

export function claimChannelPlan(input: {
  phone: string | null
  contactEmail: string | null
  emailTransport: boolean
  phoneTransport: boolean
}): ClaimChannelPlan {
  return {
    email: {
      present: emailCanReceiveCode(input.contactEmail),
      transport: input.emailTransport,
      mask: maskEmail(input.contactEmail),
    },
    phone: {
      present: phoneCanReceiveCode(input.phone),
      transport: input.phoneTransport,
      mask: maskPhone(input.phone),
    },
  }
}

export function safeInternalPath(value: unknown, fallback = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.includes('://')) {
    return fallback
  }
  return value
}
