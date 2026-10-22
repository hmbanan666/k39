# ADR 0046: Structured practical info

## Status

Accepted (2026-10-22). Amends [ADR 0028](0028-schedule.md) so one place, venue, or route can hold several schedules. Names the admission rows and the event rows that [ADR 0033](0033-typed-shared-facts.md) left as later fact kinds. [ADR 0042](0042-open-ended-hours.md) and [ADR 0044](0044-schedule-unknown-days.md) still apply to every schedule row.

## Context

Hours, ticket prices, and upcoming performances are practical facts. On 2026-10-22 three of them were still prose, or a single field, so they go stale and the page cannot mark them up.

1. A place, a venue, or a route has one schedule. The amber combine needs the observation-deck clock, the tour times, and the «Янтарная палата» sessions on one page. An organ hall needs box-office hours beside the hall clock. Each of those has its own source URL and its own check date.
2. A place ticket is the free-text column `places.price`. The page needs a list of ticket types (general, reduced, family, foreign visitors, free with a condition), each with an amount in RUB, a condition, a source URL, and a check date.
3. A concert hall cannot list the next performance. The page needs an event with a date and time, a title, a link to the official ticket seller, a source, a check date, and a retirement after that date.

The owner rule for this standard: one meaning for the whole project. A column that exists only on one page is out.

What already exists, and what this record keeps:

- [ADR 0028](0028-schedule.md) is the only hours shape. `schedules` is unique on (`entity_type`, `entity_id`). `rules` is `shared/schedule.ts` (modes, seasons, closures, holidays, exceptions, occurrences, and `slots` for tours inside open hours). `source_url` and `verified_at` sit on that one row. `schedule_intervals` answers «открыто сейчас». SSR shows the schedule text and never the live status. MCP `schedule_get`, `schedule_set`, and `schedules_list` write a place or a venue. The code entity types are `place`, `venue`, `event`, `route_stop`, and `offer`. `route` is not one of them.
- `lastEntry` on a week entry is a last-entry clock on that opening interval. It is not a second schedule and it has no source of its own.
- [ADR 0033](0033-typed-shared-facts.md) stores the hours fact as those same rules, in slot `hours`. It forbids a second schedule schema. A museum that is open only on listed dates stays `rules.occurrences`. A one-off performance was sketched as fact kind `event` with `{ title, start, end }`, phase 3, and that kind is not in `facts_kind_check` yet. Fact kind `price` is a menu row `{ itemId, itemSlug, variant, priceRub }`. The record says not to seed `places.price`. There is no events table.
- Menu anchors stay `venue_prices` and `price_items` ([ADR 0031](0031-cabinet-venue-claims.md), [ADR 0039](0039-where-cheaper.md)). They compare dishes. `price_rub` is greater than 0. The owner cabinet writes them. They feed «Ориентиры цен», `/gde-deshevle`, and `/ceny`. A guest price report does not write them ([ADR 0036](0036-guest-content.md)).
- «Коротко» on a place lists the free-text price ([ADR 0020](0020-place-guide-template.md)). A venue has the same block. A route page and a collection page do not.
- The draft token cannot change a live schedule. `schedule_set` on a published or archived place, or on a published or closed venue, is a 409, and the write is not stored in `content_drafts` ([ADR 0041](0041-collection-route-drafts.md)). `fact_update` is the same 409 when the parent is live. `fact_confirm` stays open.
- The score's practical points are 10, failure string `no prices`, from `places.hours`, `places.price`, a price heading, or a ruble amount in the article ([ADR 0016](0016-content-scoring.md)). The place catalog joins `schedules` on entity id alone, which assumes one row.
- Place hours and ticket amounts come from the official site. A map card is not a source for either. The claim table lives in `docs/facts.md` and is not copied here.

## Decision

Practical facts are rows with one writer, one renderer, and a fact beside the row. Places, venues, and routes use the same tables. A collection or a route shows events of its published members. It does not keep a second copy of those rows. Prose can mention a fact. The row is the value the page, the score, and JSON-LD read.

### Schedules

`schedules` gains `kind`, `slot`, and `label`.

- `kind` is `opening`, `box_office`, `sessions`, or `seasonal`.
- `slot` is a stable slug, `[a-z0-9-]{1,40}`. The single opening row is `main`.
- `label` is an optional Russian name, at most 80 characters, run through the stop-list. It is required when the same entity already has another row of that kind.

The unique key becomes (`entity_type`, `entity_id`, `kind`, `slot`). An entity has at most one `opening` row and at most eight schedule rows in total.

`rules` stays `shared/schedule.ts`. This record adds no field to it. [ADR 0042](0042-open-ended-hours.md) and [ADR 0044](0044-schedule-unknown-days.md) apply to every kind. Each row keeps its own `source_url` and `verified_at`. Empty `verified_at` or `rules.needsCheck` still shows the text, reports `unknown`, and emits no markup for that row.

Kind meanings:

- `opening` is the visitor clock: when a person can be there. Seasons of that same clock stay `seasons[]` on this row. `mode: slots` on this row stays what it is today, tour starts inside those hours. Only this row is expanded into `schedule_intervals`, and only this row answers «открыто сейчас» and the availability API. The interval key stays (`entity_type`, `entity_id`) because there is still one opening row.
- `box_office` is the ticket desk when its hours are not the opening hours. `lastEntry` stays a last-entry time on an opening interval. It is not moved into this row.
- `sessions` is a named series of tours or timed entry. Two series on one page are two rows (the deck tour, and «Янтарная палата»). A row uses `mode: slots` or `mode: events`. It does not write `schedule_intervals`. A gap between sessions does not make the map say the place is closed.
- `seasonal` is a second offering with its own season, such as a summer deck or a winter rink. The place's own winter and summer hours stay on `opening`. A seasonal row does not write `schedule_intervals`.

`entity_type` for these writers is `place`, `venue`, or `route`. `route` is new next to the ADR 0028 list. A `route_stop` does not gain a schedule: the stop renders the place's rows, the same rule as the hours fact. Collections, quests, hubs, and regions do not own a schedule.

The hours fact stays the rules object. The opening row keeps slot `hours`, so the key already in `facts` does not move. Every other row uses slot `hours:{kind}:{slot}`. The same transaction as `schedule_set` upserts that fact, as it does today for the one row. The fact ref path is `short.hours` for the opening row and `short.hours.{kind}.{slot}` for the others.

Calling `schedule_set` without `kind` and `slot` still writes `opening` / `main`. `remove` deletes that one row and retires its fact slot. It does not delete the other kinds.

### Admission prices

Menu anchors and admission are two families of one claim: an amount, a condition, a source, and a check date, on one subject. They do not share a table.

`venue_prices` and `price_items` stay the menu. Fact kind `price` and slot `price:{itemId}:{variant}` stay the menu fact. «Ориентиры цен», `/gde-deshevle`, `/ceny`, the owner cabinet, and the VK menu rule do not read admission. An adult museum ticket is not a catalog item. `venue_prices.price_rub` cannot store zero, and a free ticket with a condition has to.

`admission_prices` holds the ticket list for a place, a venue, or a route:

- `subject_type`, `subject_id`, `slot` (the same slug shape). Unique on those three.
- `audience`: `general`, `reduced`, `family`, `foreign`, or `free`. The same audience may repeat. The slot tells the rows apart.
- `price_rub`, integer. Greater than 0, except `free`, which is 0.
- `condition`, Russian text, at most 200 characters. Required for `reduced`, `family`, and `foreign`, and for `free` when the free entry is conditional. Empty on `free` means the visit is free. Optional on `general`.
- `label`, optional Russian override, at most 80 characters. The public names otherwise are «Взрослый», «Льготный», «Семейный», «Иностранные посетители», and «Бесплатно».
- `source_url`, `source_title`, `checked_at` (a `YYYY-MM-DD` the writer checked).
- `sort_order`.

At most 12 rows per subject. The source is the official site of the place, the museum, or the administration, the same allow-list as a place hour. A map card, an aggregator, a guest report, and a menu host (Drive, Docs, Yandex Disk, VK) are not an admission source. The amount is stated on that page. A missing amount stays off the list. `places.price` is not parsed into a row.

Fact kind `admission` is new. The implementation adds it to `facts_kind_check`. The value is `{ audience, priceRub, condition, label }`. The slot is `admission:{slot}`. TTL is 90 days, the menu price window: the queue gets a check, and the TTL does not hide the row. The page hides a row whose `checked_at` is older than `PRICE_FRESH_DAYS` (365). Risk in the queue is the price risk, 3. The implementation adds this claim to `docs/facts.md` in the same change. This record does not copy that table.

`admission_set` replaces the list for that subject, the same shape as `venue_prices_set`. Omitting a row retires its fact. A cabinet save does not write this table. The owner keeps editing `venue_prices` only.

`places.price` remains the short line in «Коротко» while the subject has no admission rows. When any admission row exists, including a row the page hides as stale, the column is not rendered. The line is then «Стоимость билета уточняйте» until a fresh row exists. The column stays in the database until a later content pass clears it.

### Events

`events` is the performance row. Fact kind `event` is the ledger beside it, the phase 3 kind from ADR 0033, with the value widened to `{ title, start, end, ticketUrl, allDay }` because a seller link does not fit the earlier sketch. The implementation adds `event` to `facts_kind_check`. The subject type stays `place` or `venue`. It does not become `event`, so the live-parent rule in ADR 0041 still resolves the parent. The slot is `event:{id}`.

Columns:

- `subject_type` (`place` or `venue`), `subject_id`.
- `title`, at most 120 characters.
- `starts_at` and optional `ends_at`, stored as `timestamptz`. The writer accepts a local `YYYY-MM-DDTHH:mm` and reads it in `Europe/Kaliningrad`, the same zone as schedule rules. `ends_at` is after `starts_at`.
- `all_day`. When true the source gave a date and no clock. The writer takes `startsOn` and an optional `endsOn` (`YYYY-MM-DD`) instead of the clock form. The page prints the date. `starts_at` is local midnight of `startsOn`. `ends_at` is the next local midnight after `endsOn`, or after `startsOn` when `endsOn` is omitted. Expiry is that `ends_at`. A guessed clock is not stored.
- `ticket_url`, optional https link. It is set only when the official source page links to that seller or to the place's own box office. An aggregator the official page does not point to is neither `ticket_url` nor `source_url`.
- `source_url`, `source_title`, `checked_at`.
- `cancelled_at`, `expired_at`.

A museum that is open only on listed dates stays `rules.occurrences` on its opening or sessions row. A performance with a title is an event. Occurrences are not converted into events by a script.

TTL is 7 days while the event is still in the future. The nightly job claims `analytics_runs` kind `event-expire`. It sets `expired_at` and retires the fact when the end (or the start, when there is no end, or the end of an all-day date) is before now in `Europe/Kaliningrad`. The public read uses the same comparison, so a missed job cannot show a past performance. A retired row stays for the revision history. `remove: true` on `event_upsert` sets `cancelled_at` and retires the fact. Cancelled and expired rows are omitted from HTML and from JSON-LD. There is no public event URL, so a cancelled event is not emitted as `EventCancelled`.

The source watcher may fetch `source_url` when it is an official http(s) page, under the existing cap. It does not fetch `ticket_url` on its own, and it does not fetch a host that needs a script. No new `verification_queue` reason. Expiry retires the row. A future event whose source changed uses `source_changed`. A check that came due uses `ttl_expired`.

### Where a page uses the rows

| Page | Owns schedules | Owns admission | Owns events | Shows events of members |
| --- | --- | --- | --- | --- |
| Place | yes | yes | yes | no |
| Venue | yes | yes | yes | no |
| Route | yes | yes | no | yes, from published stops |
| Collection | no | no | no | yes, from published member places |
| Quest, hub, region | no | no | no | no |

A collection does not merge ticket tables from its places. Those amounts belong to each place.

### Writers

One writer each, shared by MCP and `/admin`. MCP writes are audited. The draft and editor tokens keep the ADR 0035 limits. New tools:

- `schedule_get`, `schedule_set`, and `schedules_list` gain `kind`, `slot`, and `label`, and accept `entityType: route`. Omitted kind and slot mean `opening` / `main`.
- `admission_get`, `admission_set`, `admissions_list`.
- `event_get`, `event_upsert`, `events_list`. `events_list` can filter by subject or to upcoming rows.

The admin place, venue, and route forms use those writers. Practical rows are not fields of the `content_drafts` payload. The form says that an editor save of these rows is live immediately, which is already true of `schedule_set`.

The owner cabinet edits the `opening` row only, through the weekly table it already saves ([ADR 0031](0031-cabinet-venue-claims.md), [ADR 0044](0044-schedule-unknown-days.md)). Box office, sessions, seasonal rules, admission, and events stay editorial. An opening fact whose latest actor is `owner` is still not overwritten by the content token.

The draft token may write these tools only when the parent is `draft` or `review`. A published or archived place or route, and a published or closed venue, return 409 with `The live page was not changed`. Nothing is stored in `content_drafts`. `fact_update` for `admission` and `event` uses that same live-parent rule. `fact_confirm` stays allowed. The draft token cannot publish.

A guest correction is still a `guest_report`. It does not write a schedule, an admission row, or an event.

### Rendering

The renderer is server HTML. A cached page does not state a live status or a countdown.

«Коротко» is the practical summary. Place and venue pages already have it. A route page uses the same block when the route has a schedule or an admission row. Order inside the block, after the duration and season lines that already exist: schedules, then tickets. Kind order is opening, box office, sessions, seasonal. The row title is `label`, or the kind name when the label is empty: «Часы», «Касса», «Сеансы», «Сезон». The lines are `describeSchedule`. A row with `verified_at` shows «Проверено {date}» from that row. The live status chip is the opening row only, and only after hydration, as in ADR 0028.

«Билеты» is a table: the audience label, the amount in ₽ or «бесплатно», and the condition when it is set. Fresh rows only. Sort by audience in the order above, then `sort_order`. With no fresh row and no stored admission row, the free-text price line stays. With stored rows and no fresh row, the line is «Стоимость билета уточняйте».

«Ближайшее» lists upcoming events. The subject page shows eight. A route or a collection shows twelve, soonest first, and each line names the place or venue and links to that page. A line shows the title, the local date, the local time unless `all_day`, and the ticket link when `ticket_url` is set. Empty blocks are omitted.

### JSON-LD

`openingHoursSpecification` and `specialOpeningHoursSpecification` on the place or venue node are built only from the opening row, through `scheduleMarkup`, with the ADR 0042 and ADR 0044 omissions. That function already returns nothing for `slots` and `events`. Occurrences on the opening row stay "open only on these dates". They do not become `Event` nodes.

A verified seasonal row emits a `containsPlace` named with its label when `scheduleMarkup` of that row is non-empty. That node's `openingHoursSpecification` is that markup. The hours are not copied onto the parent. A verified sessions row in `mode: slots` or `mode: events` emits `Event` nodes with `location` set to the parent `@id`. `mode: slots` is one `Event` whose `eventSchedule` is a `Schedule` (`startTime`, `endTime`, `byDay`, `repeatFrequency` `P1W`, `scheduleTimezone` `Europe/Kaliningrad`). `mode: events` is one `Event` per future occurrence in the same 30-day window as the intervals. Any other sessions mode, and any unverified row, stays in the HTML.

Box-office hours stay in the HTML. They are not `openingHoursSpecification` on the parent, and they are not a `containsPlace`: a ticket desk is not a visitable place, and a department-style hours node would be read as the place's own clock.

An upcoming event emits `Event` with `name`, `startDate`, `endDate` when set, `location` `@id`, and `url`. `url` is `ticket_url` when set, otherwise the place or venue page. A date-only event uses a date `startDate`. The node has no `Offer` and no price. The ticket amounts are the admission offers on the place or venue.

Each fresh admission row is an `Offer` on the place, venue, or route node: `price`, `priceCurrency` `RUB`, `name`, `url` from `source_url`, and `description` when the condition is non-empty. `priceValidUntil` and `availability` are omitted. Nothing in the row states them.

`isAccessibleForFree` stays the current reading of `places.price` while the place has no admission rows. When fresh admission rows exist, a fresh `general` price makes it false. Otherwise an unconditional `free` row makes it true. A conditional free row with no general row leaves the property off, the same as an ambiguous price string today.

A route page uses the same HTML. Its `TouristTrip` node takes admission `Offer`s and does not take `openingHoursSpecification`, which belongs on a place. Route sessions and seasonal rows stay in the HTML. Events of stops are marked up on those place pages, so the route page does not repeat the `Event` nodes. A collection page does the same: member events stay on the member pages.

### Content score

`hasPractical` also passes when the page has a schedule row, a fresh admission row, or an upcoming event. The 10 points and the `no prices` string stay. `places.hours` and `places.price` still count, so a page that has not been moved does not lose the points.

While `places.price` is non-empty and any admission row exists, the quality block records `price text conflicts` and does not subtract those 10 points. The admin label, added with the check, is «Цена в тексте спорит с таблицей билетов». The same pattern as the status warning in [ADR 0045](0045-goal-grace-and-status-check.md): the string is visible, the points stay.

Once a page has fact refs for these rows, a ref past TTL, in conflict, or unchecked fails `stale facts`, which ADR 0033 already defines. Venue `no hours` treats an opening row as hours present.

The score catalog join on `schedules` filters `kind = opening` (and, before the column exists, the only row). A join without that filter would duplicate place rows.

### Migration of what is already published

The implementation migration is structural. It adds the columns, backfills existing schedule rows to `kind = opening` and `slot = main`, and replaces the unique index. Rules JSON is unchanged. No article text is read. The migration prefix is the next free one in `packages/database/migrations/REGISTRY.md` on `origin/main` when that PR opens. This record does not reserve a number.

Content does not move in code. There is no seed, no boot task, and no parser of `places.price`, `places.hours`, or the article. ADR 0033 already refuses to seed `places.price`. A later content pass writes a row only when an allowed source states the value, through `schedule_set`, `admission_set`, and `event_upsert`.

On a published page that pass uses the editor token. The draft token receives 409 and does not leave a pending copy. After the rows exist, the same pass clears `places.price` when it only restates the table, and trims prose that repeats a schedule, a ticket amount, or a performance. That repeat is the existing `fact_repeated` warning. It does not block publish.

### Alternatives

- Extra hours as `note`, `lastEntry`, or `occurrences` on the one opening row. One `source_url` and one `verified_at` would cover three clocks, and occurrences would mix "open only on these dates" with concerts. Open-now would follow the wrong clock.
- A second hours JSON next to `shared/schedule.ts`. ADR 0033 forbids that schema.
- Ticket rows inside `price_items` and `venue_prices`. The catalog is comparable menu lines, zero is rejected, and «Где дешевле» would rank museums. The cabinet would become the ticket writer.
- One `priced_claims` table for menus and tickets. Menu rows need an item id, a variant, and the VK rule. Tickets need an audience and a condition. The shared part is the claim, which the fact ledger already is.
- Events as `rules.occurrences` only. An occurrence has no title, no seller link, and no per-date source, and it feeds intervals.
- Events as fact rows without an `events` table. Expiry and the collection list need a row that a query can filter. The fact stays the ledger beside the row, as it does for a schedule.
- Pending practical edits inside `content_drafts`. ADR 0041 keeps schedule writes out of that payload. A second pending store would be a separate path for the same three tools.
- Every kind emitted as `openingHoursSpecification`. Box-office and session times would become the place's hours in search.
- Per-page columns such as `places.tickets`. That is a one-page shape.

### Out of scope

- The implementation of this record, including the migration, the tools, the renderer, and the score join.
- A price list on a single performance. Admission is the subject's tariff. The event carries the seller link.
- A weekly concert series stored as events. The series is a `sessions` row. A dated performance is an event.
- Cabinet editing of any kind except `opening`, and cabinet editing of admission or events.
- Quests, hubs, and regions as owners. Partner offers ([ADR 0017](0017-geo-offers.md)). `primaryAction: buy_ticket` does not create a row.
- «Где дешевле», `price_items`, and menu bands.
- A Google department node for the box office, a Yandex event feed, ticket sale, and booking.
- An event URL in the sitemap. The event is a block on the place or venue page.
- Map pins for events, and a headless fetch of a ticket seller.
- A new `verification_queue` reason. The implementation does not edit the ADR 0033 reason list.
- Copying `docs/facts.md` into this record.

## Consequences

A later PR implements this record after it is on `main`. Until that PR, pages keep reading one schedule and `places.price`.

`schedule_set` without a kind still means the opening row. «Открыто сейчас», the intervals, and the map filter ignore box office, sessions, and seasonal rows. Existing rules, including open-ended days and unknown weekdays, parse as they do today.

The draft token still cannot change practical facts on a live page. A content pass on a published page is an editor-token write. Agents with the draft token prepare the same tools on a draft or a review parent.

Menu prices and admission prices stay different rows. A museum ticket does not enter the city price index. A venue owner still edits the weekly opening hours and «Ориентиры цен», and does not edit the ticket table or the concert list.
