/**
 * A price older than this is hidden on the page: menu prices, dish prices, and
 * ticket prices (ADR 0046). The stored row stays.
 */
export const PRICE_FRESH_DAYS = 365

/** `YYYY-MM-DD`, `PRICE_FRESH_DAYS` before `now`. A price checked on that day still counts. */
export function priceFreshCutoff(now = new Date()) {
  return new Date(now.getTime() - PRICE_FRESH_DAYS * 86_400_000).toISOString().slice(0, 10)
}
