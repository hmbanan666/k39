# Facts and freshness

One lookup for a claim an agent is about to write or check. The decision is ADR 0033. Source priority and banned origins are `.cursor/skills/k39-sources-and-facts/SKILL.md`. Do not copy this table into another doc.

A gap renders «уточняйте». Maps (`map_yandex`, `map_2gis`, `map_google`, `osm`) are venue-only, and only when the official site does not state that fact. Places do not take hours, phone, address, or coordinates from a map. Prices come from the official menu or the owner, never from a map card.

| Claim | Stored in | Source kinds | Freshness |
| --- | --- | --- | --- |
| Hours | `schedules` and `schedule_intervals`. Fact kind `hours` is the schedule rules. Not `venues.hours`. | `official`, `official_social`, then a map for a venue, `owner`, or `none` | Fact TTL 30 days. Reason `season_boundary` when the next season change is inside 30 days. Open now reads intervals. The score still treats 180 days as fresh (`FRESH_DAYS`) until that reader moves. |
| Menu price | `venue_prices`. Fact kind `price` stores `{ itemId, itemSlug, variant, priceRub }`. The catalog is `price_items`. | `official` (venue site, or a PDF on drive.google.com, docs.google.com, disk.yandex.*, or yadi.sk), `official_social` (the venue's own vk.com or vk.ru page when `website` is empty and the community matches a VK link in `socials`), or `owner`. The price column stays `official` or `owner`; a VK URL is `official_social` on the fact. Screen name and numeric id (`club`, `public`, `event`, `wall-`, `market-`, `album-`, `photo-`, `doc-`, `topic-`, `video-`, `product-`) match. `venues.vk_community_id` links a screen-name social to its numeric id (ADR 0048). A `w=` or `z=` object is the owner, and the path screen name is ignored. | Fact TTL 90 days queues a check and does not hide the price. The page hides a price older than 365 days (`PRICE_FRESH_DAYS`). |
| Dish price | `venues.modules` dishes item `priceRub` | The official menu, or the owner confirming the line | Hidden after 365 days (`DISH_PRICE_FRESH_DAYS`, the same window). The stored number stays. |
| Phone | Fact kind `phone`. `venues.phone` copies that text up to `PHONE_TEXT_MAX` (200). | `official`, then a map for a venue, `owner`, or `none` | TTL 180 days, including a map or OSM phone. Those URLs are not fetched. |
| Address | Fact kind `address` | `official`, then a map for a venue, `owner`, or `none` | TTL 365 days. |
| Coordinates | Fact kind `coordinates` | `official`, then a map for a venue. Places stay on the place source. | TTL 365 days. |
| Operating status | Fact kind `status`. Place `open` / `ruins` / `closed` / `unknown`. Venue operating `open` or `closed`. | `official`, or `none` | TTL 30 days. Editorial `published` is not operating `open`. |
| Page check stamp | `places.facts_checked_at`, `venues.last_verified_at` | The day a person checked | 180 days is fresh for the score (`FRESH_DAYS`). A venue older than 180 days is labeled stale. Older than 365 days, or missing, it drops out of «Где поесть рядом» and keeps its URL (ADR 0018). |
| Repeated prose | Not a second fact. `verification_queue` reason `fact_repeated` | The rendered section | A review warning. It does not block publish. |
| Owner conflict | `verification_queue` reason `owner_conflict`, proposed value in `proposal` | The content token's proposed value | The token does not overwrite a fact whose latest revision actor is `owner`. An editor decides in `/admin`. |
| Guest report | `verification_queue` reason `guest_report`, latest text in `proposal` | A moderated guest correction. Not a source. | Does not write the fact, the schedule, or `venue_prices`. A price changes only from the official menu. |

Queue reasons in the schema today: `source_changed`, `ttl_expired`, `fetch_failed`, `source_gone`, `season_boundary`, `section_changed`, `unseeded`, `owner_conflict`, `fact_repeated`, `guest_report`. A new reason is added to `QUEUE_REASONS`, the `verification_queue_reason_check` constraint, and ADR 0033 in the same change.
