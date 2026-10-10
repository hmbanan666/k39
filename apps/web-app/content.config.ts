import { defineCollection, defineContentConfig, z } from '@nuxt/content'

const place = z.object({
  title: z.string(),
  description: z.string(),
  slug: z.string(),
  placeType: z.string(),
  status: z.enum(['open', 'ruins', 'unknown']),
  statusLabel: z.string(),
  lat: z.number(),
  lon: z.number(),
  hours: z.string().optional(),
  hoursNote: z.string().optional(),
  nameNote: z.string().optional(),
  germanName: z.string().optional(),
  sourceName: z.string(),
  sourceUrl: z.string(),
  region: z.string(),
  mapId: z.string(),
  how: z.string().optional(),
  featured: z.boolean().optional(),
})

const quest = z.object({
  title: z.string(),
  description: z.string(),
  slug: z.string(),
  steps: z.array(z.object({
    place: z.string(),
    title: z.string(),
  })),
})

export default defineContentConfig({
  collections: {
    places: defineCollection({
      type: 'page',
      source: 'places/*.md',
      schema: place,
    }),
    quests: defineCollection({
      type: 'page',
      source: 'quests/*.md',
      schema: quest,
    }),
    legal: defineCollection({
      type: 'page',
      source: 'legal/*.md',
    }),
  },
})
