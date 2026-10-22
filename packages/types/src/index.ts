import { z } from 'zod'

export const eventCreateSchema = z.object({
  type: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  placeSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120).optional(),
  routeSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120).optional(),
  questSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120).optional(),
  consent: z.literal(true),
})

export type EventCreateInput = z.infer<typeof eventCreateSchema>

export { isSocialHost } from './social-hosts'
export { parseVkCommunityId, vkCommunityIdProblem, vkMenuMatchesSocial, vkSocialLinks } from './vk-community'
