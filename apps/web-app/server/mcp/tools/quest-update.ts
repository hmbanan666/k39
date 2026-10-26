import { z } from 'zod'
import { writeQuest } from '../../utils/mcp/quests'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

const step = z.object({
  placeSlug: z.string(),
  title: z.string(),
  prompt: z.string().nullable().optional(),
})

export default defineStrictMcpTool({
  name: 'quest_update',
  description:
    'Update a quest in place. Does not create one. routeSlug points the quest at a route, including a draft. null clears the link so content_archive can delete that draft. Omit routeSlug to keep the current link. Omitting publicationStatus leaves a published quest published. A banned site in the text or a URL is rejected.',
  inputSchema: {
    id: z.string().optional(),
    slug: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().nullable().optional(),
    body: z.string().optional(),
    publicationStatus: z.enum(['draft', 'review', 'published']).optional(),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
    ogImage: z.string().nullable().optional(),
    noindex: z.boolean().optional(),
    routeSlug: z.string().nullable().optional().describe('Route slug, including a draft. null clears the link.'),
    steps: z.array(step).optional(),
  },
  handler: async (input) => writeQuest(input, 'quest_update', { create: false }),
})
