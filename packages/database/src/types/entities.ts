export type UserRole = 'user' | 'editor' | 'admin'

export type VisitStatus = 'open' | 'ruins' | 'closed' | 'unknown'

export type PublicationStatus = 'draft' | 'review' | 'published'

export type AuthorKind = 'ai' | 'human'

export type OfferKind = 'discount' | 'booking'

export type OfferStatus = 'draft' | 'active' | 'paused' | 'ended'

export type OfferCodeStatus = 'issued' | 'redeemed'

export interface SourceLink {
  title: string
  url: string
}
