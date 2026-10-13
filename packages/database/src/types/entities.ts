export type UserRole = 'user' | 'editor' | 'admin'

export type VisitStatus = 'open' | 'ruins' | 'closed' | 'unknown'

export type PublicationStatus = 'draft' | 'review' | 'published' | 'archived'

export type AuthorKind = 'ai' | 'human'

export type OfferKind = 'discount' | 'booking'

export type OfferStatus = 'draft' | 'active' | 'paused' | 'ended'

export type OfferCodeStatus = 'issued' | 'redeemed'

export type PageKind = 'place' | 'route' | 'collection' | 'hub' | 'quest' | 'venue'

export type VenueKind = 'cafe' | 'restaurant' | 'coffee' | 'bar' | 'bakery' | 'market' | 'fastfood' | 'other'

export type VenueStatus = 'draft' | 'published' | 'closed' | 'archived'

export interface VenueInterval {
  open: string
  close: string
}

export interface VenueHours {
  mon?: VenueInterval[] | null
  tue?: VenueInterval[] | null
  wed?: VenueInterval[] | null
  thu?: VenueInterval[] | null
  fri?: VenueInterval[] | null
  sat?: VenueInterval[] | null
  sun?: VenueInterval[] | null
  note?: string | null
}

export interface VenueSocials {
  instagram?: string | null
  vk?: string | null
  telegram?: string | null
}

export type PrimaryAction = 'build_route' | 'buy_ticket' | 'go_next_place' | 'claim_offer' | 'read'

export type ScoreBlock = 'quality' | 'linking' | 'indexing' | 'results'

export interface SourceLink {
  title: string
  url: string
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
