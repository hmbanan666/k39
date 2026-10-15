# Roadmap

K39 already stores places, routes, collections, quests, hubs, and partner offers (`offers`, `offer_codes`). The next work follows that model. Dates are not a plan; the order is.

## Phase 1. Content scoring

ADR 0016. Done in this change.

Each place, route, collection, hub, and quest can have a page passport: target queries, audience, the action the page should cause, and 30- and 90-day organic goals. A nightly job, and an on-demand recompute, scores the page 0–100 in four blocks: quality, linking, indexing, and results. Failing checks are stored on the row. Editors read them in `/admin/content-scores` and through the content MCP.

`claim_offer` is one of the passport actions. It does not create an offer.

## Phase 2. Offers MVP

ADR 0017. Not built yet.

A manual pilot with two or three cafes. No billing.

An editor attaches an active offer to a place or a route, using the existing `offers` row. The visitor claims a one-time code (`offer_codes`, status `issued`). The cafe marks it `redeemed`. `spent` stays 0. `bid` and `budget` can be written down and are not charged. A draft route that an offer still links cannot be deleted; that rule is already in place.

## Phase 3. Billing and a business cabinet

ADR 0017. Not built yet.

The shared cabinet and venue claims are ADR 0031: one user, a verified owner per venue, and edits to that page. Redeeming a code, showing offers in the cabinet, adding `bid` kopecks to `spent`, and pausing an offer are still this phase. `businesses.venue_id` is where a subscription will attach. Collecting the payment is a later step. Auction bids wait until redemptions are real.
