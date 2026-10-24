import { regionLabel } from './region'

export interface CollectionPlaceSource {
  slug: string
  title: string
  summary?: string | null
  note?: string | null
  categorySlug?: string | null
  categoryTitle?: string | null
  regionTitle?: string | null
  regionSlug?: string | null
  regionShortTitle?: string | null
}

export interface CollectionPlaceCard {
  href: string
  title: string
  summary: string
  hub: string
  town: string
  kind: string
}

function oneLine(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() ?? ''
}

/** Place cards for a collection. Order is the stored sequence, with no stop numbers. */
export function collectionPlaceCards(items: CollectionPlaceSource[]): CollectionPlaceCard[] {
  return items.map((item) => ({
    href: `/${item.slug}`,
    title: item.title,
    summary: oneLine(item.summary) || oneLine(item.note),
    hub: oneLine(item.categoryTitle),
    town: oneLine(regionLabel(item.regionTitle == null
      ? null
      : {
          slug: item.regionSlug,
          title: item.regionTitle,
          shortTitle: item.regionShortTitle,
        })),
    kind: oneLine(item.categorySlug),
  }))
}
