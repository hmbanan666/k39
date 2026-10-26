import { z } from 'zod'
import { updateHub } from '../../utils/mcp/hubs'
import { defineStrictMcpTool } from '../../utils/mcp/tool'

export default defineStrictMcpTool({
  name: 'hub_update',
  description:
    'Update an editable hub (category): title, description, markdown body, SEO, and noindex. A "## Частые вопросы" section in body becomes FAQPage. A question is **…?** or a ### heading. Omitting a field keeps the stored value. Hubs have no publication status. A banned site in the text or a URL is rejected. The response lists renderedFields; body is the article. Does not change users or settings.',
  inputSchema: {
    slug: z.string().describe('Hub slug: forty, zamki, plyazhi, kurorty, muzei, eda'),
    title: z.string().optional(),
    description: z.string().optional(),
    body: z
      .string()
      .optional()
      .describe('Markdown article. "## Частые вопросы" is parsed into FAQPage. A question is **…?** or a ### heading.'),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
    ogImage: z.string().nullable().optional(),
    noindex: z.boolean().optional(),
  },
  handler: async (input) => updateHub(input),
})
