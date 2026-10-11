import type { VisitStatus } from './entities'

export interface CatalogPlace {
  slug: string
  title: string
  type: string
  latitude: number
  longitude: number
  status: VisitStatus
  hours?: string | null
  sourceUrl?: string | null
  regionSlug: string
}

export interface CatalogSnapshot {
  region: {
    slug: string
    title: string
    description?: string | null
  }
  places: CatalogPlace[]
  route: {
    slug: string
    title: string
    summary?: string | null
    regionSlug: string
    points: string[]
  }
  quest: {
    slug: string
    title: string
    summary?: string | null
    routeSlug: string
    steps: Array<{
      placeSlug: string
      title: string
      prompt?: string | null
    }>
  }
}
