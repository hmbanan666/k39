# ADR 0018: Venues catalog

## Status

Accepted.

## Context

Place pages are editorial articles about forts, castles, beaches, and towns. A cafe is a different object: it has hours, a bill, a phone, and it goes stale. ADR 0017 already stores `offers` and `offer_codes` for a later pay-per-result pilot. Those offers can point at a place or a route. They cannot point at the business a visitor would actually walk into, and the site has no list of those businesses.

Geo-targeted ads need that list first. Impressions and a business cabinet come after the rows are trustworthy. The first slice is food and drink. Shops, rentals, and tours should not need a second table.

## Decision

### Domain

`venues` is the catalog. A venue is not a place and is not a business account. `businesses` stays the later owner of an offer. `places` stay articles.

`kind` is a short latin token, not a Postgres enum. The first set is `cafe`, `restaurant`, `coffee`, `bar`, `bakery`, `market`, `fastfood`, and `other`. A later kind (`shop`, `rental`, `tour`) is another token that matches `^[a-z][a-z0-9_]{0,31}$`. The food block and the public food filters use the first set only. A new kind does not appear in «Где поесть рядом» until a block for it exists.

`status` is `draft`, `published`, `closed`, or `archived`.

- A draft is not public.
- `published` is the live card.
- `closed` stays on its URL with `noindex` and a closed note. It leaves nearby blocks and the public list.
- `archived` records a 410 for `/zavedeniya/{slug}`, the same idea as an archived route (ADR 0014).

Publishing requires a Russian description of 300–600 characters. A published row whose description is later emptied is `noindex` and leaves the sitemap. Drafts may have an empty description.

Photos use the existing `media` pipeline (ADR 0011) through `venue_media`, the same shape as `place_media`. The first attached photo is the cover.

`offers.venue_id` is a nullable foreign key. An offer may still point at a place, a route, or both. The venue link is what the sponsored slot and a later cabinet read. Codes stay on `offer_codes`. Nothing in this record charges `spent` or opens a login. That remains ADR 0017 phase 2 and phase 3.

Hours are JSON: seven weekdays (`mon`–`sun`), each `closed` or `opens`/`closes` as `HH:MM`, plus an optional note. Cuisine tags, sources, and socials are JSON arrays. `price_level` is 1–4. `avg_check` is rubles, nullable. Money on the offer stays kopecks.

`osm_id` is nullable and unique (`node/123`, `way/456`). It is the dedupe key for imports, not a public URL.

A venue slug cannot be a region slug or a public kind segment (`kofe`, `kafe`, `restoran`, `bar`, `pekarnya`, `rynok`, `fastfud`, `drugoe`). One path segment resolves in that order: region, kind, then venue. Two segments are a region and a kind, for example `/zavedeniya/svetlogorsk/kofe`.

### Staleness

`last_verified_at` is the last human or bot check. OSM import does not set it.

- Missing, or older than 180 days: the venue page and any card that still shows the venue say the facts are stale.
- Older than 365 days, or missing: the venue is left out of «Где поесть рядом». It can remain on its own URL and on the listing.
- A listing shows published venues, including stale ones, with the note.

### Sourcing

`venue_import_osm` reads Overpass. The query is `amenity` in `cafe`, `restaurant`, `bar`, `fast_food`, `pub`, `ice_cream`, plus `shop=bakery`, and it sends `[timeout:90]`. The client identifies itself as `K39/1.0 (+https://k39.online)`, waits longer than that query timeout, retries with backoff, then tries `overpass.kumi.systems` if the primary endpoint is unavailable. The caller passes a point and a radius, or a bounding box. Both are capped.

A generated slug that is already taken, or that matches a region or a kind path, is not rejected. The next candidate appends the town (`addr:city`, `addr:town`, `addr:place`, or the region slug) and then the district (`addr:suburb` and the same family). A number (`-2`, `-3`) is used only after those suffixes. An editor-chosen slug still fails, and the error names a slug clash or an `osmId` clash separately.

Hours that were never set stay an empty week. The public card says «Часы уточняйте». JSON-LD omits `openingHours` and `openingHoursSpecification` until a day has `opens` and `closes`. A real closed weekday is still «выходной» when some other day is open.

Each new element becomes a `draft`. `osm_id` already stored is returned as existing and is not rewritten, so a second import cannot wipe an editor's text. The tool never sets `published`. A person or a later bot publishes with `venue_update` after the description, hours, and coordinates are checked. `last_verified_at` is that check.

Nameless elements are skipped. `ice_cream` is stored as `other` with a cuisine tag. `pub` is `bar`. A cafe whose cuisine is coffee is `coffee`.

### Ranking

Nearby blocks take up to five published food venues inside 5 km. A place uses its own coordinates. A route uses the minimum distance to any stop that has coordinates. Order is distance. The public distance is `400 м` or `1,2 км`.

On a place page «Где поесть рядом» is its own block in the article column, after «Как добраться», with a contents entry (`PAGE_SECTIONS.eatNearby`). The full-width «Рядом» grid holds places only. Each row carries the venue's schedule rules (ADR 0028), and the browser computes «открыто сейчас» from them after hydration. Only a verified schedule reports open or closed; anything else reads «Часы неизвестны». Server HTML has the same list for bots and people, without a live status. A place with no venue in range has no block and no contents entry.

One sponsored slot sits in front of that order when `FEATURE_SPONSORED_VENUES=true`. The slot is the nearest candidate that has an `offers` row with `venue_id` set and `status = active`. The card says «Партнёр». The flag defaults off, so the block is distance only and shows no partner label. Later auction work can replace which active offer wins the slot. It should not add a second ranking path.

### Impressions

Page views of `/zavedeniya/{slug}` are ordinary cookieless `pageview` hits (ADR 0013). `analytics_hits.venue_id` is set from that path. A nearby block sends one `impression` event per shown venue through the same beacon. The hit keeps the page path (the place or the route) and stores the venue id from the target. Bots and signed-in editors are still dropped. No cookie is added. `venue_stats` reads those rows. Impressions are not the bill. ADR 0017 still bills a redeemed code, not a view.

### Scores and search

Published venues are scored with the other public pages (ADR 0016). Drafts, closed rows, and archived rows are not. The venue quality block checks the description length, one photo, hours, `last_verified_at` inside 180 days, coordinates, and the passport. Article length, FAQ, and «Как добраться» do not apply. The listing link from `/zavedeniya` is the inbound link the score counts.

The venue URL is in the sitemap when it is published, not `noindex`, and the description is present. Its photos are image entries. JSON-LD is `CafeOrCoffeeShop` for `cafe` and `coffee`, `Restaurant` for the other food kinds, and `LocalBusiness` for `market`, `other`, and any later non-food kind, plus `BreadcrumbList`. `priceRange`, `servesCuisine`, and `openingHoursSpecification` are written only when those facts are stored. A week with no open day omits hours. A missing description forces `noindex`.

`/zavedeniya` is an indexable section. `/zavedeniya/{region}`, `/zavedeniya/{kind}`, and `/zavedeniya/{region}/{kind}` are indexable when `venue_listing_intros` has an intro of at least 300 characters for that pair. A filter without an intro still renders and is `noindex`.

### Tools

The content token (ADR 0012) can call `venue_create`, `venue_update`, `venue_get`, `venues_list`, `venue_import_osm`, `venue_listing_intro_set`, `venue_stats`, and `venue_delete`. Writes and the read-only stats call insert an `mcp_audits` row. The token still cannot manage users or settings. `venue_update` may set `status` and `lastVerifiedAt`. Omitting `status` leaves the current one, including `published`. `venue_delete` hard-deletes a draft or an archived row. A published or closed venue returns 409 and stays. An archived URL keeps the 410 recorded when it was archived.

## Consequences

Editors and agents publish venues only after a check. OSM is a draft source, not the live site. The sponsored label cannot appear until the flag is on and an offer is active, so the catalog can ship before any cafe pays. Adding shops later is a new `kind` and, when they should be advertised, a block that names them. It is not a new table.

## Addendum: action links, dishes and photo origin (migration 0023)

- `booking_url`, `order_url`, `delivery_url`, `menu_url`: official pages only.
  The menu is linked, never copied.
- `reservation` (`yes`, `no`, `required`, `recommended`), `takeaway`,
  `delivery`: facts as in the OSM tags of the same name. Null means unknown.
- `signature_dishes`: up to five `{ name, note, priceRub }`, written by us
  from a visit or from what the venue sent.
- `venue_media.origin`: `own`, `venue` (sent with permission) or `commons`.
  Author, license and source stay on `media`. `media_attach_to_venue` refuses
  a photo without an author.
- OSM import maps `reservation`, `takeaway`, `delivery`, `website:menu` and
  `contact:*` (vk, telegram, instagram, facebook, whatsapp, youtube, ok).
- The public page shows a field only when it is set. No ratings.

## Addendum: listing modules

`venue_listing_intros.modules` holds optional blocks for a town or kind listing: `choose`, `situation`, `areas`, `season`, and `faq`. `venue_listing_modules_set` replaces the list and does not change the intro. The page renders them around the card grid. `faq` adds FAQPage when the listing is indexable. Details are in `docs/venue-modules.md`.

## Addendum: cabinet claims (ADR 0031)

`contact_email` stores the official mailbox (OSM `email` / `contact:email`). It is not rendered. A verified owner edits `venues.modules` and `venue_prices` through `/kabinet`, with the same checks as `venue_update` and `venue_prices_set`. Status, slug, and SEO stay editorial. `businesses.venue_id` is the later subscription link.

## Addendum: Meta links

A venue social, site, booking, order, delivery, or menu URL on a Meta host is a plain-text `MetaLink` (`docs/design-system.md`). The public page and the owner cabinet both render it with the asterisk. The footnote lists only the products linked on that page. There is no Meta logo.
