import type { SeoDocument } from '~~/shared/seo'
import { headFromDocument, tuneRobots } from '~~/shared/seo'

export function usePublicHead(doc: SeoDocument) {
  const route = useRoute()
  const query: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(route.query)) {
    query[key] = Array.isArray(value) ? value[0] : value
  }
  useHead(headFromDocument(tuneRobots(doc, query)))
}
