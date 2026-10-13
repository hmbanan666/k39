# ADR 0001: Place copy in Nuxt Content, operations in Postgres

## Status

Superseded by ADR 0007. Place copy now lives in Postgres, not in Nuxt Content.

## Context

Place pages must be crawlable without a database round trip, and editors will write them as markdown. Offers, redemptions, and analytics events are transactional and need foreign keys.

## Decision

Editorial pages live in `@nuxt/content` (`content/places`, `content/quests`) with frontmatter for slug, type, coordinates, status (`open`, `ruins`, `unknown`), hours, source URL, and region.

Postgres holds `regions`, `places`, `routes`, `route_points`, `quests`, `quest_steps`, `businesses`, `offers`, `offer_codes`, and `events`. The web app upserts the forts catalog from `shared/data/catalog.json` after migrations so those rows exist for events and future offers. Offer money fields are integer kopecks (`bid`, `budget`, `spent`). There is no payment flow yet.

The prototype's richer visit status (museum, military, restoration, and so on) is kept as Russian `statusLabel` text. The canonical column only stores `open`, `ruins`, or `unknown`.

## Consequences

Place text lives in Postgres. The booklet geometry under `app/data/forts/` was removed with ADR 0002. A business offer cannot point at a place until that place is in the catalog snapshot.
