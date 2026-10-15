import { db } from '@k39/database'
import { auditMcp } from '../../utils/mcp/audit'

export default defineMcpTool({
  name: 'price_items_list',
  description: 'List the shared catalog of benchmark menu items for «Ориентиры цен» (cappuccino, margherita, philadelphia...). Venue prices point at these slugs, so venues compare across the region.',
  annotations: { readOnlyHint: true },
  inputSchema: {},
  handler: async () => {
    await auditMcp('price_items_list', 'price_item', null)
    return { items: await db.prices.items() }
  },
})
