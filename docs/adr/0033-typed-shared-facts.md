# ADR 0033: Typed shared facts as the core data layer

## Status

Accepted.

This record does not add tables or change pages. Phase 1 is the first build. Later phases are named and are not part of that build. Open questions were resolved on 2026-10-16; the answers are under Resolved.

## Context

Agents re-check content by reading whole pages. The bill grows with the catalog, including pages nobody edited. K39 is on its way to a media catalog of thousands to tens of thousands of pages. Confidence has to survive the next run: an unchanged fact stays verified, and a change reopens only that fact or that section.

The same facts are already copied. A museum's hours can sit in `schedules`, in `places.hours`, in a route stop note, in a module, and in JSON-LD. A price can sit in `venue_prices` and again in a sentence. Nothing says those copies are one claim.

What exists today:

- Places, venues, and collections store `sources` as `{ title, url }` (`SourceLink`). The list is the whole page. It has no claim, no source kind, and no TTL. The public «Источники» block renders it.
- Places and venues have one `last_verified_at`. The score treats a place or venue as fresh for 180 days (`FRESH_DAYS` in `apps/web-app/shared/scoring.ts`). Missing is `facts not checked`. Routes, collections, hubs, and quests have no such column, so their score uses `updated_at` (ADR 0016). `place_update` sets the place stamp with `factsCheckedAt` and can do that without rewriting the article.
- Opening hours already have one shape: `schedules` (ADR 0028). Rules cover seasons, closures, holidays, exceptions, and event occurrences, in `Europe/Kaliningrad`. `source_url` and `verified_at` sit on that row. Empty `verified_at` or `rules.needsCheck` shows the text and reports status `unknown`. A daily job rebuilds `schedule_intervals`. «Открыто сейчас» reads those intervals, not the article.
- `venue_prices` is already per claim: `price_rub`, `checked_at`, `source_kind` (`official` or `owner`), `source_url`. The shared catalog is `price_items`. The page hides a price older than 365 days (`PRICE_FRESH_DAYS`). Dish prices use the same window (ADR 0032). That hide rule is display, not a verification queue.
- A published venue with `last_verified_at` missing or older than 180 days is labeled stale. Older than 365 days, or missing, it drops out of «Где поесть рядом» and keeps its own URL (ADR 0018).
- Places have `hours`, `price`, `how_to_get`, coordinates, `status`, and `source_url`. They have no phone column and no address column. Address and transport live in prose. Place hours, phone, address, and coordinates do not come from Yandex Maps or 2GIS. Venue address, hours, phone, operating status, and coordinates come from the official site, then a map or OSM for a fact the site does not state, then «уточняйте» (`.cursor/skills/k39-sources-and-facts/SKILL.md`).
- Routes keep order in `route_points` (`place_id`, `position`, `note`) and an optional `path`. A stop does not copy the place's hours. Quests point at a route.
- There is no events table. Dated openings inside a schedule stay `rules.occurrences`.
- Page passports and the 0 to 100 score are ADR 0016. `content_report_weekly` compares that score to about seven days earlier. It does not check facts. Personas and coverage sit on the same admin page (ADR 0024, ADR 0025).
- Seasonal hours are rules inside `schedules`, not a monthly job. The cabinet edits a weekly table; seasonal rules stay on `schedule_set`. A seasonal editor in the cabinet is deferred (ADR 0031).
- Publish review is two agent passes over the stored page (`.cursor/skills/k39-publish-review/SKILL.md`). Nothing tells the second pass which lines changed.
- Nightly work already uses `analytics_runs` so a restart does not repeat a kind (`content-scores`). Traffic for priority is already stored: `analytics_daily.pageviews`, and search-console `impressions` on `analytics_search_queries` (ADR 0013). There is no separate on-site impression counter.
- Module pages render `collections.modules`. `body` is the projection of that prose, not a second article (ADR 0023). Place and route articles are `sections` (ADR 0027).

A page-shaped ledger (one row per page field, copied onto every route that mentions the museum) would multiply storage and still let two pages disagree. The durable object is the fact. Pages cite it.

## Decision

End state: structured claims live once, as typed facts. Pages, venue cards, JSON-LD, the schedule interval job, and later tools (open now, where cheaper, a trip plan, MCP) read those rows. Prose stays prose, hashed per section, and is reviewed only where the text changed.

Phase 1 writes facts beside the columns that already exist. Readers do not move yet. That is deliberate: a new ledger must not fork «открыто сейчас» or the price cards before the rows are trustworthy.

### Fact identity

`facts` holds the current value. One museum clock is one row. A route, a collection card, and the place page reference it. They do not store their own copy.

Unique among live rows: `(kind, subject_type, subject_id, slot)`.

- `subject_type`: `place`, `venue`, `route`, `route_stop`, `region`. Later: `transport_line`, `event`.
- `slot`: a stable name on that subject. `hours`, `phone`, `address`, `coordinates`, `status`, or `price:{itemId}:{variant}`. The price value stores `{ itemId, itemSlug, variant, priceRub }`. The id is the identity. The slug is for people.

A ticket price or a menu price belongs to one subject. The shared part of «Ориентиры цен» remains `price_items`. The fact does not duplicate the catalog. `route_points` remain the order of a route. `routes.path` remains drawn geometry, not a sourced claim. A stop renders the place's hours fact. It does not get a second hours row.

### Columns

`facts`:

- `kind`, `subject_type`, `subject_id`, `slot`
- `value` jsonb, checked by the zod schema for that kind
- `value_hash`, SHA-256 of canonical JSON
- `source_url`, `source_title`, `source_kind`
- `checked_at`
- `ttl_days`, default from the kind, overridable per row
- `confidence`: `stated`, `owner`, or `gap`
- `retired_at`, null while live
- `updated_at`

Confidence is that enum, not a percentage. A number would look sharper than the source.

- `stated`: an allowed URL states this value.
- `owner`: the cabinet wrote it (ADR 0031). `source_kind` is `owner`. No URL.
- `gap`: allowed sources are silent. The value is the explicit unknown («уточняйте»), never a guess.

`source_kind`, in the priority the sources skill already uses:

1. `official`. Site of the place, museum, administration, or venue, including a menu page or a PDF on that site.
2. `official_social`. The venue's own official social account, for a fact that page states.
3. `map_yandex`, `map_2gis`, `map_google`, `osm`. Venues only. Only address, hours, phone, operating status, and coordinates. Only when the official site does not state that fact. Places still do not take those fields from a map. Google Maps follows the same rule as Yandex Maps and 2GIS.
4. `owner`. Cabinet.
5. `none`. A gap, or a seed that has no URL yet.

The official site wins a conflict. Maps and OSM do not override it. Two maps that disagree, with the site silent, are not merged. One sourced value, or a gap.

### History

`fact_revisions` is append-only: `fact_id`, `recorded_at`, `value`, `value_hash`, source fields, `checked_at`, `confidence`, `actor` (`migration`, `editor`, `owner`, `mcp`).

A new value or a new source writes a revision. Confirming the same `value_hash` does not. The watcher never writes a revision and never parses a page into a value.

The existing `revisions` table remains the snapshot of a place, venue, or route row. It is not this history.

### Kinds, schemas, freshness

Schemas live in one module beside `shared/schedule.ts`. The hours value is the schedule `rules` object. There is no second hours shape. `venues.hours` (the old weekday JSON) is not a source for new facts. ADR 0028 already moved recognized hours into `schedules`.

TTL is how often the server re-fetches a watchable source. It is not how often an agent re-reads the catalog.

| Kind | Value | Default TTL | Phase |
| --- | --- | --- | --- |
| `hours` | Schedule rules: mode, seasons, closures, holidays, exceptions, occurrences, note | 30 days | 1 |
| `price` | `{ itemId, itemSlug, variant, priceRub }` | 90 days | 1 |
| `phone` | `{ text }` as displayed | 180 days | 1 |
| `address` | `{ text }` | 365 days | 1 |
| `coordinates` | `{ latitude, longitude }` | 365 days | 1 |
| `status` | Place `open`, `ruins`, `closed`, `unknown`. Venue operating `open` or `closed`. Not the editorial `draft` / `published` / `archived` | 30 days | 1 |
| `transport` | `{ summary, lines? }` | 30 days | 2 |
| `seasonality` | `{ text }` until a later structured season is worth it | 90 days | 3 |
| `event` | `{ title, start, end }` | 7 days while the end is in the future, then retire | 3 |
| `history` | `{ text }` for a dated claim (a year, a name) | 365 days | 3 |

Phase 1 does not change public windows. The score's 180 days, the venue stale label, the 365-day drop from «Где поесть рядом», and `PRICE_FRESH_DAYS` stay until a reader moves. A 90-day price TTL enqueues a check. It does not hide the price.

An hours fact whose next season boundary falls inside 30 days is queued with reason `season_boundary` even when the source hash matched. That queue filter is the monthly seasonal-hours pass. It does not add the deferred cabinet editor.

A one-off event is an `event` fact in phase 3. A museum that is open only on listed dates stays `rules.occurrences` on the hours fact. Two calendars would drift.

### References

`fact_refs`: `fact_id`, `consumer_type`, `consumer_id`, `path`. Unique on those four. `path` is where the page renders it (`short.hours`, `modules.prices`, `stop:{position}`).

JSON-LD is not a consumer. It reads the same refs as the page. Deleting a subject sets `retired_at` and removes refs. Revisions stay.

### Prose, per section

Body sections, module text, FAQ, summaries, hub markdown, and quest steps stay prose until a later phase lifts a claim into a fact. Verification of that prose is a hash, not an agent pass over the catalog.

`page_reviews` is one row per page (`page_type`, `entity_id`): `reviewed_at`, `reviewer` (user id or `mcp`), and the set of `{ path, hash }` last accepted.

The hash is SHA-256 of the normalized section that actually renders. Trim, collapse whitespace. For a module page, hash each module's prose, not the projected `body` column (ADR 0023). For a classic article, hash the body sections. Picker query params do not change stored modules, so they do not change hashes.

The hash is the identity of the text. The path is only where it sits now (`modules[3]`, `sections[1]`, `faq[0]`, `summary`). A reorder whose text is unchanged matches the stored hashes and opens nothing. A changed section, wherever it moved, is the only unreviewed one. `page_mark_reviewed` replaces hashes for the paths it names. A later prune drops hashes that no longer match any section, so the set cannot grow without bound.

A fact confirm does not mark prose reviewed. A prose review does not confirm facts.

### Source watcher

`source_documents` is one row per normalized URL: `content_hash`, `etag`, `last_modified`, `http_status`, `fetched_at`, `next_fetch_at`, `fail_count`. No response body and no excerpt. We do not store copies of other sites. An agent fetches the URL when a person has to read a diff.

Watchable URLs are `official` and `official_social` http(s) pages and menu PDFs already stored on a fact. The watcher does not fetch Yandex Maps, 2GIS, OSM, or any host that needs a login or a script. Those facts are not hashed. When `checked_at + ttl` passes, they queue as `ttl_expired`. That is the only unchanged source that still needs an agent.

The job is a Nitro plugin, once a night, claimed in `analytics_runs` with kind `source-watch`.

Each night, take URLs with `next_fetch_at <= now`, cap 500. Order: hours, status, and transport first, then URLs cited by the highest 30-day pageviews, then the oldest fetch. One request at a time per host, about one request per second overall, 10 second timeout, redirects followed, a K39 user agent. Send `If-None-Match` when we have an etag. A 304 is unchanged.

Normalize by dropping script and style and collapsing whitespace, then hash. A PDF hashes extracted text. If extraction fails, that is a fetch failure, not a new fact value.

- Unchanged hash: set `checked_at` to the fetch time on every fact with that URL whose value was not edited after the previous fetch. No revision, same as `fact_confirm`. Do not enqueue. This includes a TTL that has elapsed. Zero model calls.
- Changed hash: do not parse and do not write a value. Queue `source_changed`.
- Network error or 5xx: back off `next_fetch_at` (1, 2, 4 days, cap 14). Queue `fetch_failed` only after three failures.
- 404 or 410: queue `source_gone` once.

After a success, `next_fetch_at` is the fetch time plus the shortest TTL on that URL. Anything past the cap of 500 waits for the next night. At a 30-day TTL, about 15,000 distinct official URLs is 500 a night. That is the sizing target. Past it, raise the cap. Do not add a second queue service.

### Queue and priority

`verification_queue` is the only work list. Agents do not scan `places_list` to re-check fresh facts.

Columns: `target` (`fact` or `section`), `fact_id`, `page_type`, `entity_id`, `path`, `reason`, `priority`, `enqueued_at`, `locked_by`, `locked_until`.

Reasons: `source_changed`, `ttl_expired`, `fetch_failed`, `source_gone`, `season_boundary`, `section_changed`, `unseeded`.

One open row per target and reason. The watcher, the save path, and the nightly score job upsert it. An agent does not insert rows.

Priority is an integer stored on the row and recomputed when content scores run, so `queue_list` does not join analytics:

`priority = risk × round(ln(1 + traffic))`

Risk: status, hours, and transport 5; price, seasonality, and event 3; phone, address, and coordinates 2; history and prose 1. `season_boundary` adds 2 on top of hours.

Traffic for a fact is the sum, over pages that reference it, of `analytics_daily.pageviews` for 30 days plus `analytics_search_queries.impressions` for those paths. A published page with neither still counts as 1, so a new page is not stuck at zero. Drafts are not queued, except `section_changed` on a page already in `review`. Archived rows are not queued.

`queue_list` with `claim: true` sets a 30-minute lock. Other callers skip locked rows. An expired lock is open again.

### MCP

The content token, the same 60 calls per minute, and an `mcp_audits` row (ADR 0012). The token still cannot manage users or settings.

- `queue_list`. Filters: kind, reason, minimum priority, limit (default 20, max 50). `claim` optional.
- `fact_get`. The fact, its refs, and the latest revisions.
- `fact_confirm`. The caller sends the `value_hash` it read. The server rejects a mismatch. Same hash: move `checked_at`, close that fact's queue rows, no revision.
- `fact_update`. New value, source, and confidence. The kind schema runs first. Writes a revision, replaces the current row, closes that fact's queue rows. Does not change publication. Does not mark prose reviewed.
- `page_mark_reviewed`. Stores hashes for the given paths. `all: true` accepts every current section only when each hash still matches the text. A path that changed since the read is rejected and left open.

`content_guide` tells agents to start at `queue_list`.

`schedule_set` and `venue_prices_set` stay the writers for those shapes. The same transaction upserts the fact. Phase 1 does not make an editor call `fact_update` for a schedule they already saved. A cabinet save upserts with actor `owner` and does not enqueue an agent to rediscover that edit. A later source change still can.

### Scores, passports, weekly report, seasonal hours

`/admin/content-scores` shows derived trust:

- verified: every ref is inside its TTL and every rendered section hash is in `page_reviews`
- stale facts: a ref is past TTL, in conflict, unchecked, or `source_gone`
- unreviewed changes: a section hash is missing from the review set

Verified stands alone. Stale facts and unreviewed changes can show together.

The row shows counts (`2 stale`, `1 section`) and the table can filter on each label. The passport form does not grow fields. A passport is still the goal (queries, audience, action, 30- and 90-day goals).

Score fact check, once the page has refs: fail `stale facts` when any ref is past TTL, in conflict, or unchecked. Do not also fail the 180-day `last_verified_at` check. A page with no refs keeps today's check.

`content_report_weekly` adds the open queue size by reason and the ten highest-priority rows. It does not recompute facts. It may name a page that is both under its 30-day goal and in the queue. That is the weekly review. It reads the queue.

The monthly seasonal-hours pass is `queue_list` with `kind=hours` and `reason=season_boundary`. It is not a crawl.

Publish review stays two passes. The reviewer loads the queue rows for that page. Updating the skill text is a later edit. This record only fixes what that pass is supposed to read.

`last_verified_at` keeps being written by the existing tools, and «Проверено {date}» keeps reading that column in phase 1. A prose-only review does not move it. Phase 2 points that line at the oldest fresh fact `checked_at`, so the page cannot claim a newer check than its stalest fact.

### Readers, in phases

Phase 1. Tables, the six phase-1 kinds, the seed below, the watcher, the queue, the five MCP tools, the trust column, and the score and weekly hooks. Dual write from schedule, price, and venue phone, address, and status saves. Readers stay on `schedules`, `places`, `venues`, `venue_prices`, and `schedule_intervals`.

Phase 2. Place pages, venue cards, and JSON-LD read phase-1 facts. The public reader is `readShownFacts` in `apps/web-app/server/utils/facts/read.ts`. Transport facts come off `how_to_get` and stop notes through the queue, not a bulk extract. Routes and collections reference place facts. A prose section that repeats a fact value is a review warning, not a publish block.

Phase 3. Seasonality, events, and history, and only when a section is already queued. «Where cheaper» and a trip plan read price and hours facts. Open now stays on intervals built from the hours fact. Retire `venues.hours` and free-text place hours once nothing reads them. Then drop the page-level freshness stamp in favor of the oldest fresh fact.

Out of every phase: a headless browser, fetching map cards, storing source HTML, an agent that lists every place, a second schedule schema, a message bus.

### Migration

One SQL migration, then an idempotent seed recorded like `content_imports`, so a second boot does not insert again.

1. Hours from `schedules`. Value is `rules`. Source is `schedules.source_url`. `checked_at` is `verified_at`. Empty `verified_at` or `needsCheck` is unchecked, or `gap` when the value is empty, and queues `unseeded`. Ref on the place or venue at `short.hours`.
2. Prices from `venue_prices`, one fact per row. `official` and `owner` map across. `checked_at` maps across. Ref at `modules.prices`. Do not copy `price_items`.
3. Venue phone, address, and coordinates from `venues`, with `last_verified_at`. Attach a URL from `venues.sources` only when that URL is already the schedule or price source for the same venue, or the venue `website`. Otherwise leave `source_kind` `none` and queue `unseeded`. Do not guess which citation proves which field. OSM coordinates with no `last_verified_at` stay unchecked. OSM import still does not set `last_verified_at`.
4. Venue operating status: seed `closed` when `venues.status` is `closed`. Do not treat `published` as a sourced `open`.
5. Place `status` and coordinates, unchecked when `last_verified_at` is null. Do not seed free-text `places.price`. A number there becomes a price fact only when `fact_update` has a real URL. Place hour strings that never became schedule rules stay out of the hours fact.
6. Page-level `sources` arrays stay the «Источники» list. The seed does not spray one URL onto every claim.

Routes, route stops, collection modules, and hub bodies are not turned into facts in this seed.

Section hashes are backfilled once. Every current rendered section is stored as already reviewed, reviewer `migration`, so day one does not queue the archive. Only a later edit opens `section_changed`. The first queue is structured facts that are unchecked or past TTL.

### Indexes and storage

At the high end of this plan, about 50,000 pages, a venue with about 20 facts and a place with about 8, many of those shared:

- `facts`: on the order of 200,000 to 500,000 live rows
- `fact_revisions`: a few changes a year, low millions after several years
- `fact_refs`: a small multiple of facts
- `source_documents`: distinct official URLs, expected under 100,000
- `page_reviews`: one row per page
- `verification_queue`: the open set, thousands

The existing Postgres database is enough. No second store.

Indexes:

- unique `facts (kind, subject_type, subject_id, slot)` where `retired_at` is null
- `facts (kind, checked_at)` for the TTL scan
- `fact_refs (consumer_type, consumer_id)` and `fact_refs (fact_id)`
- `fact_revisions (fact_id, recorded_at desc)`
- `source_documents (next_fetch_at)`
- unique `page_reviews (page_type, entity_id)`
- `verification_queue (priority desc, enqueued_at)` where the lock is open
- unique open queue row per target and reason

Rows stay narrow because source bodies are not stored. Hours values are the schedule JSON already in `schedules`, not a copy of the article.

### Cost and scale

These are sizing assumptions, not a quote. Take 20,000 published pages and an agent that reads a whole page, about 2,000 input tokens, whenever a routine runs.

A monthly full rescan is on the order of 40 million input tokens, and it repeats on pages that did not change. At 50,000 pages the same habit is about 100 million input tokens a month before any edit.

After this layer the nightly watcher is HTTP, a hash, and a few hundred row updates. An unchanged official source renews every fact on that URL. Sharing is what flattens the curve: one museum clock is one fetch, however many routes cite it. Agent calls follow the queue (source diffs, unwatchable TTL expiries, season boundaries, changed sections). A few percent of sources changing in a month, and a few percent of sections edited, is the token bill. Priority spends those calls on high pageviews, high search impressions, and high-risk kinds first.

What still grows with the catalog is the fetch batch and the score job. Both already have a daily claim, and the fetch has a cap. Model cost should stay roughly flat from 5,000 to 50,000 pages while the change rate, not the page count, is what enqueues work.

## Consequences

A page is verified when its fact refs are inside TTL and its section hashes match a review. The next run does not redo that work. An edit reopens the fact or the section that changed. Shared facts keep one hours row as the catalog grows.

Until phase 2, the live site still reads the tables it reads today. A fact write reaches the public page only through the same schedule or price write editors already use.

Phase 1 does not hide prices at 90 days, does not drop venues from «Где поесть рядом» any sooner, and does not fetch map cards.

## Resolved

Owner answers, 2026-10-16:

1. Auto-renew when an official source hash is unchanged, including past TTL. Yes. No agent re-read when the hash matches.
2. A venue phone taken from a map or OSM lives 180 days, same TTL as a phone from an official site. Maps and OSM stay unfetched; those facts still queue on TTL.
3. The prose backfill marks today's sections reviewed without an agent pass. No one-time sweep of the existing archive. Only a later edit opens `section_changed`.
4. The content token must not overwrite a published fact the owner set last. An owner conflict waits for an editor in `/admin`.
5. Transport stays in phase 2. No transport fact is required in phase 1 for places that already publish `how_to_get`.
