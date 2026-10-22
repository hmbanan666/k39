import type { PageKind, PrimaryAction, StoredPageModule } from './entities'

export interface ScoreChecks {
  quality: string[]
  linking: string[]
  indexing: string[]
  results: string[]
}

/** The stored schedule row (ADR 0028). The web app parses `rules` and decides whether the hours are known. */
export interface CatalogSchedule {
  rules: unknown
  verifiedAt: string | null
}

export interface ScorePlace {
  /** Schedule rules mode, null when the place has no schedule. */
  scheduleMode?: string | null
  schedule?: CatalogSchedule | null
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
  faq: Array<{ question: string, answer: string }>
  faqCount: number
  categorySlug: string | null
  categoryTitle: string | null
  /** Stored schema.org subtype. Null uses the hub mapping. */
  schemaType?: string | null
  regionId: string | null
  regionTitle: string | null
  updatedAt: string
  firstPublishedAt?: string | null
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
  /** Page modules (collections only, ADR 0023); empty elsewhere. */
  modules: StoredPageModule[]
  sourcesCount: number
  firstPublishedAt?: string | null
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
  firstPublishedAt?: string | null
}

/** Stored passport override. Scoring rules: apps/web-app/shared/length-override.ts. */
export interface LengthOverride {
  ceiling: number
  queries: string[]
  search: { impressions: number, position: number } | null
  competitors: Array<{ query: string, chars: number }>
  sections: string[]
  setAt: string
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
  lengthOverride: LengthOverride | null
}

export interface CatalogVenue {
  id: string
  slug: string
  name: string
  kind: string
  description: string
  /** Hours come from this row only, never from the legacy `venues.hours` column. */
  schedule: CatalogSchedule | null
  latitude: number | null
  longitude: number | null
  publicationStatus: 'draft' | 'published'
  noindex: boolean
  seoTitle: string | null
  seoDescription: string | null
  factsCheckedAt: string | null
  regionSlug: string | null
  regionTitle: string | null
  updatedAt: string
  firstPublishedAt?: string | null
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
  venues: CatalogVenue[]
  related: Array<{ fromSlug: string, toSlug: string }>
  photos: Array<{ placeId: string, count: number }>
  venuePhotos: Array<{ venueId: string, count: number }>
  passports: CatalogPassport[]
  /** Admission rows and upcoming events per subject (ADR 0046). */
  practical?: CatalogPractical[]
}

export interface CatalogPractical {
  subjectType: string
  subjectId: string
  admissionRows: number
  freshAdmission: number
  upcomingEvents: number
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
  lengthOverride?: LengthOverride | null
}
