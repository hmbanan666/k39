# ADR 0018: Venues catalog

## Status

Accepted.

## Context

Place and route pages tell a visitor where to go, and ADR 0017 keeps partner offers on `offers` / `offer_codes`. Nothing yet lists the cafes and bars around those pages. Later geo-targeted ads need a stable venue, a place to attach an offer, and a count of how often that venue was shown. The first slice is food and drink. The same table can hold other kinds later.

OSM is a useful draft source. It is not a publisher. A page that recommends a cafe has to say when a person last checked the hours and the address.

## Decision

`venues` is a new table (migration `0013_venues`). A venue has `slug`, `name`, `kind` (`cafe`, `restaurant`, `coffee`, `bar`, `bakery`, `market`, `fastfood`, `other`), cuisine tags, `region_id`, address, coordinates, `price_level` (1–4) and `avg_check` in rubles, structured `hours` (weekday intervals plus a free-text note), phone, website, socials, a Russian description, `sources`, `status` (`draft`, `published`, `closed`, `archived`), `last_verified_at`, and a nullable unique `osm_id`. `seo_title` and `seo_description` are optional search overrides, the same idea as on a place. Photos use the existing media pipeline through `venue_media`, the same shape as `place_media`.

`offers.venue_id` points at a venue. The offer still belongs to a business and can still point at a place or a route. Deleting a venue sets `venue_id` null. It does not delete the offer or its codes.

A venue is stale when `last_verified_at` is missing or older than 180 days. Stale venues stay on their page and on `/zavedeniya`, with the note «Давно не проверяли». Nearby blocks omit a venue whose check is missing or older than 365 days. Nearby distance is haversine, capped at 2 km, shown as `400 м` or `1,2 км`. A place uses its own coordinates. A route uses the coordinates of its stops and keeps the shortest distance when the same venue is near more than one stop. The block shows up to five venues.

`FEATURE_VENUE_SPONSOR` defaults off. The nearby ranker still has a sponsored slot: when the flag is on, the closest venue with an active offer (`offers.status = active` and `venue_id` set) is placed first and labeled «Партнёр». When the flag is off, order is distance only and the label is not rendered. The content score uses distance order, so a score run does not depend on the flag.

Public URLs:

- `/zavedeniya/{slug}` is the venue. Description missing means `noindex` and the URL stays out of the sitemap. Archived returns 410. Draft returns 404. Closed stays public with the label «Закрыто». JSON-LD is `Restaurant` for cafe, restaurant, coffee, bar, bakery, and fast food, and `LocalBusiness` for market and other, plus `BreadcrumbList`.
- `/zavedeniya` lists published and closed venues. `/zavedeniya/{region}` and `/zavedeniya/{region}/{kind}` are filter pages (`kofe` is coffee, as in `/zavedeniya/svetlogorsk/kofe`). A venue slug must not reuse a region slug or a kind slug. `venue_listing_intros` stores the intro for a filter (`region_slug` + kind slug, empty string for the index). Filter pages with at least one indexable venue, or a saved intro, are in the sitemap.

Publishing requires a description of 300–600 characters. Drafts and OSM imports may be shorter. The maximum on every write is 600.

MCP, same bearer token, rate limit, and `mcp_audits` row as the other content tools:

- `venue_create`, `venue_update` (including `lastVerifiedAt` and `status`), `venue_get`, `venues_list` (region, kind, near lat/lng + radius, status, stale).
- `venue_import_osm` reads Overpass (`amenity` cafe, restaurant, bar, fast_food, pub, ice_cream, and `shop=bakery`) for a bbox or a point plus radius. It inserts drafts with `osm_id`, name, coordinates, address, and hours, website, and phone when the tags exist. An existing `osm_id` is skipped. It never publishes.
- `venue_listing_intro_set` writes a filter intro.
- `venue_stats` reads cookieless impressions. The nearby block beacons `impression` through the existing `/api/collect` path when a card is on screen. The target is `venue:{slug}`. Bots are stored and left out of the count. No new cookie.

ADR 0016 scores a published or closed venue. Quality is five checks: description length 300–600, at least one photo, weekday hours, `last_verified_at` within 180 days, and coordinates. Linking, indexing, and results stay the four-block model. A passport may be stored for `pageType: venue`. It is not one of those five checks. Drafts and archived rows are not scored.

`/admin/venues` lists and edits venues, including the gallery.

## Consequences

Nearby recommendations appear only after a person sets `last_verified_at`. An OSM draft can sit unpublished with hours copied from the map. Impression counts are page views of the nearby block, not clicks and not redemptions. ADR 0017 still bills a redeemed code, not an impression. The sponsored slot is present and dark until `FEATURE_VENUE_SPONSOR=true`.
