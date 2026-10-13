import type { Collection } from '@k39/database'
import { orderedStopView } from './routes'

type CollectionStop = Parameters<typeof orderedStopView>[0][number]

/** Every stored collection column, plus the ordered places. */
export function collectionView(row: Collection, items: CollectionStop[]) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    ogImage: row.ogImage,
    publicationStatus: row.publicationStatus,
    noindex: row.noindex,
    updatedBy: row.updatedBy,
    kind: row.kind,
    month: row.month,
    sources: row.sources,
    items: orderedStopView(items),
  } satisfies Collection & { items: ReturnType<typeof orderedStopView> }
}
