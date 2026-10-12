import type { PageKind, PrimaryAction } from './entities'

export interface ScoreChecks {
  quality: string[]
  linking: string[]
  indexing: string[]
  results: string[]
}

export interface ScorePlace {
  id: string
  slug: string
  title: string
  summary: string
  body: string
  howToGet: string | null
  hours: string | null
  price: string | null
  latitude: number | null
  longitude: number | null
  publicationStatus: 'draft' | 'review' | 'published'
  noindex: boolean
  seoTitle: string | null
  seoDescription: string | null
  factsCheckedAt: string | null
  sources: Array<{ title: string, url: string }>
  categorySlug: string | null
  categoryTitle: string | null
  regionId: string | null
  regionTitle: string | null
  updatedAt: string
}

export interface CatalogArticle {
  id: string
  slug: string
  title: string
  summary: string
  body: string
  publicationStatus: 'draft' | 'review' | 'published'
  noindex: boolean
  seoTitle: string | null
  seoDescription: string | null
  updatedAt: string
  routeSlug: string | null
}

export interface CatalogStop {
  parentId: string
  placeSlug: string
  placePublished: boolean
  regionId: string | null
  access: string | null
}

export interface CatalogHub {
  id: string
  slug: string
  title: string
  description: string
  body: string
  noindex: boolean
  seoTitle: string | null
  seoDescription: string | null
  updatedAt: string
}

export interface CatalogPassport {
  id: string
  pageType: PageKind
  entityId: string
  path: string
  targetQueries: string[]
  audience: string | null
  primaryAction: PrimaryAction | null
  goal30d: number | null
  goal90d: number | null
  notes: string | null
}

export interface ContentCatalog {
  places: ScorePlace[]
  routes: CatalogArticle[]
  routeStops: CatalogStop[]
  collections: CatalogArticle[]
  collectionStops: CatalogStop[]
  quests: CatalogArticle[]
  questStops: CatalogStop[]
  hubs: CatalogHub[]
  related: Array<{ fromSlug: string, toSlug: string }>
  photos: Array<{ placeId: string, count: number }>
  passports: CatalogPassport[]
}

export interface PageMetric {
  path: string
  organic7d: number
  organic30d: number
  organic90d: number
  pageviews30d: number
  outboundClicks: number
  continuations: number
  avgEngagedMs: number | null
  engageEvents: number
  scrollMax: number | null
  scrollEvents: number
}

export interface StoredScore {
  pageType: PageKind
  entityId: string
  path: string
  title: string
  total: number
  quality: number
  linking: number
  indexing: number
  results: number
  checks: ScoreChecks
  signals: Record<string, unknown>
  organic30d: number
  organic90d: number
  goal30d: number | null
  goal90d: number | null
}

export interface PassportWrite {
  pageType: PageKind
  entityId: string
  path: string
  targetQueries?: string[]
  audience?: string | null
  primaryAction?: PrimaryAction | null
  goal30d?: number | null
  goal90d?: number | null
  notes?: string | null
}
