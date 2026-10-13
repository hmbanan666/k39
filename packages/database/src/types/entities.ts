export type UserRole = 'user' | 'editor' | 'admin'

export type VisitStatus = 'open' | 'ruins' | 'closed' | 'unknown'

export type PublicationStatus = 'draft' | 'review' | 'published' | 'archived'

export type AuthorKind = 'ai' | 'human'

export type OfferKind = 'discount' | 'booking'

export type OfferStatus = 'draft' | 'active' | 'paused' | 'ended'

export type OfferCodeStatus = 'issued' | 'redeemed'

export type PageKind = 'place' | 'route' | 'collection' | 'hub' | 'quest' | 'venue'

export type PrimaryAction = 'build_route' | 'buy_ticket' | 'go_next_place' | 'claim_offer' | 'read'

export type ScoreBlock = 'quality' | 'linking' | 'indexing' | 'results'

export type CollectionKind = 'theme' | 'month'

export interface SourceLink {
  title: string
  url: string
}

export interface PlaceFaqItem {
  question: string
  answer: string
}

export type MediaStatus = 'processing' | 'ready' | 'failed'

export type MediaLicense = 'own' | 'cc-by' | 'cc-by-sa' | 'cc0' | 'pd' | 'permission'

export interface MediaVariant {
  format: 'avif' | 'webp' | 'jpeg'
  width: number
  height: number
  bytes: number
  file: string
}
