import type { Collection } from '@k39/database'
import { collectionWritePlan } from '../../../shared/page-modules'
import { orderedStopView } from './routes'

type CollectionStop = Parameters<typeof orderedStopView>[0][number]

/** Every stored collection column, plus the ordered places and what renders. */
export function collectionView(row: Collection, items: CollectionStop[]) {
  const plan = collectionWritePlan({
    sentBody: undefined,
    currentBody: row.body,
    modules: row.modules,
  })
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
    firstPublishedAt: row.firstPublishedAt,
    updatedBy: row.updatedBy,
    kind: row.kind,
    month: row.month,
    sources: row.sources,
    modules: row.modules,
    items: orderedStopView(items),
    article: plan.article,
    renderedFields: plan.renderedFields,
  } satisfies Collection & {
    items: ReturnType<typeof orderedStopView>
    article: 'modules' | 'body'
    renderedFields: readonly string[]
  }
}
