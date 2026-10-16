import { db } from '@k39/database'
import { projectMenuPrices } from './menu-prices'

/**
 * Fresh published menu prices after the fact overlay.
 * One query (`Prices.freshPublished`) plus the shared comparable filter.
 * Cards, town listings, the sitemap, and price bands all read this set.
 * Owner rows stay on the venue card and are not peers.
 */
export async function loadMenuPrices(now = new Date()) {
  const rows = await db.prices.freshPublished(now)
  const projected = await projectMenuPrices(rows, now)
  return {
    rows: projected.map((item) => item.row),
    comparable: projected.filter((item) => item.comparable).map((item) => item.row),
  }
}

/** Official menu rows used as the town sample. */
export async function loadComparablePrices(now = new Date()) {
  const menu = await loadMenuPrices(now)
  return menu.comparable
}

export function peersByItem<T extends { item: string }>(rows: T[]) {
  const peers: Record<string, T[]> = {}
  for (const row of rows) {
    const list = peers[row.item] ?? []
    list.push(row)
    peers[row.item] = list
  }
  return peers
}
