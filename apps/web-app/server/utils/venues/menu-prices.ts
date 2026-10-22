import type { MenuColumn, MenuFact } from '../../../shared/price-compare'
import { db } from '@k39/database'
import { priceFreshCutoff } from '@k39/types/freshness'
import { resolveMenuPrice } from '../../../shared/price-compare'

function asMenuFact(row: {
  confidence: string
  sourceKind: string
  sourceUrl: string | null
  sourceTitle: string | null
  checkedAt: string | null
  value: unknown
  path: string
}): MenuFact & { path: string } {
  return row
}

function pickFact(rows: Array<MenuFact & { path: string }>, item: string, variant: string) {
  let best: MenuFact | undefined
  let bestScore = -1
  for (const row of rows) {
    const value = row.value
    if (!value || typeof value !== 'object') {
      continue
    }
    const record = value as { itemSlug?: unknown, variant?: unknown }
    if (record.itemSlug !== item || record.variant !== variant) {
      continue
    }
    const score = (row.path === 'modules.prices' ? 2 : 0) + 1
    if (score > bestScore) {
      best = row
      bestScore = score
    }
  }
  return best ?? null
}

/**
 * Overlay cited price facts on menu columns. A missing fact keeps the column.
 * Callers that build «Где дешевле» keep `comparable` rows only.
 * The venue website, socials, and VK community id are loaded here. A vk.com
 * menu counts only when the website is empty and the community matches a
 * stored VK link or the declared id (ADR 0048).
 */
export async function projectMenuPrices<T extends MenuColumn>(rows: T[], now = new Date()) {
  if (!rows.length) {
    return []
  }
  const cutoff = priceFreshCutoff(now)
  const ids = [...new Set(rows.map((row) => row.venueId))]
  const [cited, linkRows] = await Promise.all([
    db.facts.forConsumers('venue', ids, ['price']),
    db.venues.menuLinksFor(ids),
  ])
  const links = new Map(linkRows.map((row) => [row.id, row]))
  const byVenue = new Map<string, Array<MenuFact & { path: string }>>()
  for (const fact of cited) {
    const list = byVenue.get(fact.consumerId) ?? []
    list.push(asMenuFact(fact))
    byVenue.set(fact.consumerId, list)
  }
  return rows.flatMap((row) => {
    const link = links.get(row.venueId)
    const venue = link ? { website: link.website, socials: link.socials, vkCommunityId: link.vkCommunityId } : undefined
    const resolved = resolveMenuPrice(row, pickFact(byVenue.get(row.venueId) ?? [], row.item, row.variant), cutoff, venue)
    return resolved ? [resolved] : []
  })
}
