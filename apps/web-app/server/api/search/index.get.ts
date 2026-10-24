import { db, normalizeSearchQuery, SEARCH_QUERY_MAX } from '@k39/database'
import { areaSearchResults } from '../../../shared/search-results'

// Pure read (ADR 0030). Logging happens in POST /api/search/events after the
// page shows the results, so prefetches and bots do not count as searches.
export default defineEventHandler(async (event) => {
  const raw = String(getQuery(event).q ?? '').slice(0, SEARCH_QUERY_MAX)
  const normalized = normalizeSearchQuery(raw)
  const results = normalized ? await db.search.query(raw) : []
  const regions = results.length ? await db.editor.listRegions() : []
  return { query: raw.trim(), normalized, results: areaSearchResults(results, regions) }
})
