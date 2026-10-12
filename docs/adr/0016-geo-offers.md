# ADR 0016: Geo offers, claim codes, and the business funnel

## Status

Accepted.

Phase 2 and phase 3 below are the roadmap. This record does not build them. The tables they use are already in Postgres.

## Context

A place page can already show a partner offer. `businesses`, `offers`, and `offer_codes` have been in the schema since the first migration. An offer belongs to a business and points at a place, a route, or both. `kind` is `discount` or `booking`. `bid`, `budget`, and `spent` are integer kopecks. `status` is `draft`, `active`, `paused`, or `ended`. A code is `issued` or `redeemed`, with `issued_at`, `redeemed_at`, and an optional `session_id`.

The public place page loads `Content.activeOffers` and renders `PartnerOffer` with the title and terms. The label is `партнёр K39`. There is no button that issues a code, no staff screen that redeems one, and no charge: nothing writes `spent`. ADR 0001 said there is no payment flow. That is still true.

Quests and routes already depend on this table. `content_archive` refuses to delete a draft route while an offer still has that `route_id` (ADR 0014). The page passport's `claim_offer` action (ADR 0015) names the page where a later claim should start. It does not create an offer.

## Decision

Offers stay on `offers` and `offer_codes`. A new claim flow does not get a second code table. Money stays in kopecks. The funnel has three phases. Only phase 1 is in the product now.

Phase 1, content scoring, is ADR 0015. A page can record `claim_offer` and an organic-visit goal before any cafe is attached.

Phase 2 is a manual pilot with two or three cafes and no billing.

- An editor creates the `businesses` row and an `offers` row with `status = active`, a title, and terms. The offer points at the cafe's place, or at a route that passes it. `bid` and `budget` may be filled in so the terms are written down. `spent` stays 0.
- The place page keeps `PartnerOffer`. A visitor asks for a code. The server inserts one `offer_codes` row (`issued`, a unique code). Repeating the claim in the same browser session returns that code instead of issuing another.
- Cafe staff mark the code `redeemed` and set `redeemed_at`. There is no payment capture, no invoice, and no business login. The editor creates and pauses offers in `/admin` or through the content API.
- A route that an offer still links cannot be hard-deleted. That rule already exists and stays.

Phase 3 is pay per redemption and a self-serve cabinet.

- Redeeming a code adds `bid` to `spent`. When `spent` reaches `budget`, the offer becomes `ended` and new codes stop. The charge is the redeemed code, not an impression and not a click.
- The business owner signs in and sees only their offers, issued codes, and redemptions. They can pause an offer. They cannot edit place articles or site settings.
- Taking the money (a card charge or an invoice) is a later step. Phase 3 records what is owed. Auction bids, named in the product brief, wait until this cabinet has real redemptions to bid on.

Booking (`kind = booking`) stays a column. Phase 2 only pilots the discount code. A confirmed booking is the same pay-per-result idea and uses the same code row when that pilot starts.

## Consequences

Phase 2 can ship on the current tables: an issue endpoint, a redeem endpoint, and a staff form. It should not add a parallel offer model. `PartnerOffer` stays quiet when the place has no active offer. Codes are the result the business pays for, so phase 3 must not bill a pageview.
