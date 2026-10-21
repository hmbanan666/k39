import type { MenuColumn, MenuFact } from '../../../shared/price-compare'
import { db, PRICE_FRESH_DAYS } from '@k39/database'
import { resolveMenuPrice } from '../../../shared/price-compare'

/** Day string `PRICE_FRESH_DAYS` before `now`. Prices on that day still count. */
export function priceFreshCutoff(now = new Date()) {
  return new Date(now.getTime() - PRICE_FRESH_DAYS * 86_400_000).toISOString().slice(0, 10)
}

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
 * The venue website is loaded here so a vk.com menu counts only when that field is empty.
 */
export async function projectMenuPrices<T extends MenuColumn>(rows: T[], now = new Date()) {
  if (!rows.length) {
    return []
  }
  const cutoff = priceFreshCutoff(now)
  const ids = [...new Set(rows.map((row) => row.venueId))]
  const [cited, siteRows] = await Promise.all([
    db.facts.forConsumers('venue', ids, ['price']),
    db.venues.websitesFor(ids),
  ])
  const sites = new Map(siteRows.map((row) => [row.id, row.website]))
  const byVenue = new Map<string, Array<MenuFact & { path: string }>>()
  for (const fact of cited) {
    const list = byVenue.get(fact.consumerId) ?? []
    list.push(asMenuFact(fact))
    byVenue.set(fact.consumerId, list)
  }
  return rows.flatMap((row) => {
    const venue = sites.has(row.venueId) ? { website: sites.get(row.venueId) ?? null } : undefined
    const resolved = resolveMenuPrice(row, pickFact(byVenue.get(row.venueId) ?? [], row.item, row.variant), cutoff, venue)
    return resolved ? [resolved] : []
  })
}
