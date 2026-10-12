import { auditMcp } from '../../utils/mcp/audit'
import { resolveScoredPage, writePassport } from '../../utils/scoring/run'
import { passportWriteSchema } from '../../utils/scoring/schemas'

export default defineMcpTool({
  name: 'page_passport_set',
  description: 'Create or update a page passport: targetQueries, audience, primaryAction (build_route, buy_ticket, go_next_place, claim_offer, read), goal30d, goal90d, notes. Omitted fields stay as they are. Does not publish the page and does not create an offer.',
  inputSchema: passportWriteSchema.shape,
  handler: async (input) => {
    const page = await resolveScoredPage(input)
    if (!page) {
      throw createError({ statusCode: 404, statusMessage: 'Страница не найдена' })
    }
    const saved = await writePassport(page, input)
    await auditMcp('page_passport_set', page.pageType, page.entityId)
    return saved
  },
})
