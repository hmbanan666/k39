# ADR 0049: Dated temporary notices

## Status

Accepted (2026-10-22, accepted by Nick).

Compatible with [ADR 0028](0028-schedule.md), [ADR 0042](0042-open-ended-hours.md), [ADR 0044](0044-schedule-unknown-days.md), and [ADR 0046](0046-structured-practical-info.md). It does not add a field to schedule `rules`. The schedule stays the only hours. When this record is implemented, the pending payload from [ADR 0035](0035-draft-content-token.md), [ADR 0041](0041-collection-route-drafts.md), and [ADR 0047](0047-venue-pending-drafts.md) gains a `notices` key. Those three records gain an "amended by" line in that implementation. This record does not edit them.

The Insterburg window starts on 2026-11-01 and ends on 2026-11-13. The public page shows that notice for the whole window only if the implementation is on `main` and an editor has applied the row before 2026-11-01. This record does not write that row.

## Context

A page has to show a time-bound fact that is not opening hours, with exact dates and an official source, and it has to stop showing that fact on its own when the date has passed. Prose cannot carry it. A stale sentence stays until someone edits it. The stop-list does not name «пока» or «сейчас», and a closure sentence that uses them stays in the article. [ADR 0045](0045-goal-grace-and-status-check.md) only scores that sentence against an open schedule. Hours repeated in prose are a `fact_repeated` warning. A venue price retelling is a copy-rule hit. None of those remove the sentence on a date.

Three cases:

1. Venue `insterburg-chernyakhovsk`. The venue's own VK post `https://vk.com/wall-214626383_1742` says the cafe works at ул. Ленина, 5А from 2026-11-01 through 2026-11-13 and is back at ул. Крупской, 3А on 2026-11-14. The post does not publish hours.
2. Place `zamok-georgenburg`. Under reconstruction, opening planned for 2027-05-01. The source is already in the place's sources. Collection prose that said the castle is viewed from outside was removed. The page still has nowhere to put the planned date.
3. The same shape, later: a museum closed for renovation, a seasonal ferry not running, a section of a route closed.

What already exists, and why it does not fit:

- [ADR 0028](0028-schedule.md) is the only hours shape. `rules` in `shared/schedule.ts` holds seasons, closures, holidays, `exceptions[]`, and occurrences. An exception is one date, `closed`, optional `opens` and `closes`, and a `note` of at most 80 characters. It has no address. [ADR 0042](0042-open-ended-hours.md) keeps an exception without `closes` as a closed day, so `closed: false` cannot mean "open, hours unpublished". Thirteen exceptions would still not say where the cafe moved.
- `mode: closed` may carry `closure` (`reason`, optional `until`, `viewableOutside`). `closureText` prints `until`. `statusFromRules` does not read it: the mode stays closed after that date until a person changes the row. `closure` has no address and no source of its own. The schedule row has one `source_url`.
- [ADR 0046](0046-structured-practical-info.md) adds schedule kinds, admission, and events. It adds no field to `rules`. A `seasonal` row is a second offering, not a temporary address. An event is a performance with a title. Neither hides a relocation, and neither is allowed to invent hours.
- The hours fact, the address fact, and `places.status` / venue operating status are standing claims ([ADR 0033](0033-typed-shared-facts.md), `docs/facts.md`). Writing the temporary address into the address fact, or flipping status to `closed`, sticks until someone remembers to put the old value back. Coordinates have the same problem. A guessed pin is forbidden.
- «Коротко» is the practical summary on a place and a venue ([ADR 0020](0020-place-guide-template.md)). SSR shows the schedule text and never a live «открыто сейчас» ([ADR 0028](0028-schedule.md)). The live chip is computed in the browser from the opening row. `GET /api/public/availability` is `no-store` and answers from `schedule_intervals`.
- `scheduleMarkup` emits `openingHoursSpecification` from the opening row, and `specialOpeningHoursSpecification` for the next closed exception days. A closed exception is emitted as `opens` `00:00` and `closes` `00:00`. That is the schedule's own one-day mark. It is not a pattern to copy onto a notice that has no hours.
- A draft-token write to a published or archived place, or to a published or closed venue, is stored in `content_drafts` and the live row stays ([ADR 0035](0035-draft-content-token.md), [ADR 0047](0047-venue-pending-drafts.md)). Practical rows other than the venue opening schedule and menu prices stay a 409 with nothing stored ([ADR 0046](0046-structured-practical-info.md)). Notices are not those rows.
- The owner cabinet writes the live opening hours and the stored address ([ADR 0031](0031-cabinet-venue-claims.md)). It does not write admission or events.

## Decision

Store a list of temporary notices in a table, `notices`. One row is one dated statement. Places and venues own rows now. The public page reads the list at request time, in `Europe/Kaliningrad`, and omits a row whose last day has passed. The row is not a fact, and it is not a schedule.

### Options

1. **Extend `exceptions[]` or `closure`.** Rejected. An exception is one date and cannot hold an address. A span without published hours cannot be stored as open. `closure.until` does not hide itself, and ADR 0046 forbids a new `rules` field. One `source_url` would cover both the standing hours and the notice.
2. **A jsonb list on `places` and `venues`.** Rejected. Expiry is a scan of every page. A route would need a third copy of the same shape later. ADR 0046 already refused a per-page column for tickets for that reason. The nightly flag would parse JSON instead of updating a date column.
3. **Table `notices`.** Chosen. One row per statement, a subject type and id, a date filter in the public query, and one update that sets `expired_at`. Places and venues share the writer. A later route record widens the check constraint. It does not invent a second shape.

A fact kind `notice` was considered with option 3 and rejected. The score's `stale facts` path, the source watcher, and `fact_refs` would then count the row. This record says a notice is never a fact.

### Who owns a row

| Page | Owns notices now | Later |
| --- | --- | --- |
| Place | yes | |
| Venue | yes | |
| Route | no | Same table, when a closed section can name its stops. Not in this record. |
| Collection | no | No. Member notices stay on the member page. A collection does not list them. |
| Quest, hub, region | no | No. |

`subject_type` is `place` or `venue` in the check constraint. The writer rejects anything else. A ferry that is itself a place uses a place row. A route section does not.

### Kinds

The kind selects the render and the status rule. A new kind that changes the status line or the address line needs its own ADR.

- `relocation`. The subject is operating at another address for the window. The Insterburg move. Requires `address`. Does not change the status line.
- `closed`. The subject does not receive visitors for the window, and the source does not give replacement hours. A museum shut for renovation, a ferry that is not running. Overrides the status line while current. No address.
- `renovation`. Work is underway and the page is still that place. Georgenburg, including when the outside can still be seen. The outside view goes in `text`. Does not change the status line and does not set `places.status`. No address.
- `other`. A dated statement that is none of those, such as a temporary entrance that is not a new address. It does not change the status line and has no address. It exists so one season does not add a kind. The text has to carry the concrete fact.

`closed` and `renovation` cannot overlap. Two rows of the same kind cannot overlap. A row with no `to` overlaps every later date. Other combinations may overlap. Overlap is checked on the list after replace, and a row whose `to` is already before today does not take part, so keeping an expired row does not block the next window. At most four rows are stored for one subject, including rows already flagged expired, so a cleanup has to delete before a fifth row is added.

### Columns

`notices`:

- `subject_type`, `subject_id`.
- `kind`: `relocation`, `closed`, `renovation`, `other`.
- `starts_on`, `ends_on`. The API names are `from` and `to`. Both are `YYYY-MM-DD` calendar dates. `from` is required. `to` is the last date the statement is still true, inclusive. Null only when `open_ended_reason` is set.
- `open_ended_reason`. Required when `to` is null, forbidden when `to` is set. At most 200 characters. Editorial, not rendered. It says what the source withheld, for example that the page gives no end date. The stop-list runs. The relative-time ban below does not, because this is the place that records a missing end.
- `text`. Russian, 1 to 160 characters after trim.
- `address`. At most 200 characters. Required for `relocation`, forbidden for the other kinds. The words the source uses. No coordinates column.
- `source_url`, `source_title` (1 to 160 characters).
- `checked_at`. The `YYYY-MM-DD` the writer opened the source. Not later than today in `Europe/Kaliningrad`.
- `expired_at`. Null until the nightly job flags the row. The public read does not depend on it.

`to` is on or after `from`. The migration prefix is the next free one in `packages/database/migrations/REGISTRY.md` on `origin/main` when the implementation opens. This record does not reserve a number. No backfill, no seed, and no parser of article text.

### When a row is shown

Compare `from` and `to` with today's calendar date in `Europe/Kaliningrad`, the same zone as schedule rules. UTC is the wrong date between local midnight and 02:00.

- Today before `from`: upcoming. Shown, with both dates.
- `from` through `to`, inclusive, or `to` null: current. Shown.
- Today after `to`: hidden. Omitted from HTML, from the chip, and from the availability answer. A missed job cannot leave it on the page, because the read does not look at `expired_at`.

An open-ended row does not hide itself. It stays until an editor sets `to` or removes it.

A planned opening on day D means the notice is still true on the day before D. The writer sets `to` to that previous day. Georgenburg, if the source says the opening is 2027-05-01, has `to` of 2027-04-30. If the source gives no start date, `from` is `checked_at`, not a guessed construction date.

The Insterburg return to ул. Крупской, 3А is not a second notice. The stored address is the address that applies outside the window. On 2026-11-14 the relocation row is hidden and that stored address is what the page shows. The notice tool does not write the address column.

### Text, source, and the stop-list

`text` and `address` go through the stop-list (`WRITING_STOP_LIST`, `WRITING_STOP_PATTERNS`, and `VENUE_COPY_RULES` for a venue). The notice schema also rejects, as whole words: пока, сейчас, скоро, временно, сегодня, завтра, вчера, на днях. The renderer prints the dates, so the text does not need a relative word. A clock (`H:MM` or `HH:MM`) and a ruble amount (`₽` or `руб`) are rejected. Hours stay on the schedule. Prices stay on the price rows. A year and a calendar date in the text are allowed.

The source is official, as in `.agents/skills/k39-sources-and-facts/SKILL.md` and `isOfficialUrl`:

- A place accepts only class `official`: a page on the site of the place, the museum, or the administration. A social URL, a map card, a file host, and an aggregator are rejected. Place hours do not come from a social account, and neither does this notice.
- A venue accepts class `official`. It also accepts the venue's own official social account when that page is what states the notice and the site does not. The VK post on Insterburg is that case. The community match is the one ADR 0048 already uses for a wall id (`socials`, plus `vk_community_id` when the URL has only the number). The menu rule that VK counts only when `website` is empty does not apply here. When the site also states the notice, `source_url` is the site. A map card, OSM, a file host, and an aggregator are rejected. A temporary address is not filled in from a map.

`source_url` is required. The notice tool does not copy it into the `sources` column. While the notice is in the HTML, the same URL is added to the collapsed «Источники» list for that response. When the notice hides, the link disappears unless the page already stored it.

### Temporary address

`address` on a `relocation` is shown as text. It does not write the address fact, `venues.address`, place `how_to_get`, or the coordinates. `readShownFacts` is unchanged. The map pin stays. JSON-LD `address` stays the stored venue address, or the place address the page already emits. The directions link stays on the stored coordinates. This record does not geocode. During the window the route button can still aim at the stored pin. That is accepted. A guessed point would be worse.

«Коротко» keeps the address line it already has. On a venue that line is the stored address. On a place it is `shortAddress` of `how_to_get`. While the relocation is upcoming or current, the block adds the notice address under «Другой адрес», with the date line.

### Schedules

The notice writer does not call `schedule_set`, does not write `rules`, and does not rebuild `schedule_intervals`. `mode: closed` and `closure.until` stay what they are: a standing closure whose end does not arrive by itself. A dated closure that must disappear is a notice, not a `closure.until`.

A current `closed` notice overrides the status line:

- The hydrated chip (`OpeningLive` on the page and on the venue card) shows the closed date line and does not show «Открыто…» or «Закрыто, откроется…». The chip gets `from`, `to`, and `kind` and re-checks them in `Europe/Kaliningrad`, so a tab left open past `to` stops saying closed.
- `GET /api/public/availability` returns `closed` for instants inside the window, with no `opensAt` taken from the intervals. «Где поесть сейчас» follows that answer, so the venue is not under «Открыто сейчас». Outside the window the intervals apply again, with no write.
- The weekly lines from `describeSchedule` stay in «Коротко». They are the standing hours. The notice says they do not apply on these dates.
- The override applies when the schedule is missing or unverified. The notice is the sourced claim for that window. Upcoming `closed` does not override. `renovation`, `relocation`, and `other` do not override.

A relocation therefore does not clear a verified clock. If the standing hours are known not to apply at the temporary address, that is a separate `schedule_set`, and only when the source states the hours. The Insterburg post does not state them, so the content pass must not add exceptions and must not invent a close.

### Rendering

One helper builds the lines. The banner and «Коротко» use it, so the two cannot drift.

The banner is an `aside` in the hero. On a place it sits after the closed note and before the directions link. On a venue it sits after the stored address line. The visible heading is «На эти даты». It is omitted when nothing is visible. Current notices come first, then upcoming ones, so a future window is not presented as already in effect. Inside each group: `closed`, `renovation`, `relocation`, `other`, then `from` ascending. Each notice shows the date line, the kind label, and `text`. A relocation also shows `address`.

The date line is exact Russian, genitive month, no leading zero, no em dash:

- both ends: «с 1 ноября 2026 по 13 ноября 2026»
- open-ended: «с 1 ноября 2026»

An upcoming notice uses that same line, with both dates when `to` is set. The dates are the upcoming mark. There is no «скоро» and no «сейчас». Kind labels, which are chrome and not the stored text: «Закрыто», «Реконструкция», «Другой адрес». `other` has no label besides `text`. The stored `text` is the statement as it reads during the window. The date line is rendered before it, including while the notice is still upcoming, so the sentence is scoped by those dates.

«Коротко» prints the same lines at the top of the block, above the hours. The place hero sentence «Закрыто для посещения» stays tied to `places.status = closed` with no verified schedule, as it is today. A notice does not flip that column.

The banner is request HTML. It is correct for the request that rendered it. Place and venue HTML have no `cache-control` in `routeRules`. The chip is the surface that updates without a reload.

Venue cards do not grow a banner. A current `closed` notice replaces the card's open chip with the same closed date line. Listings that only call the availability API get `closed` from there. The card payload still includes the notice, because a chip computed from rules alone would ignore it.

### JSON-LD

A notice adds nothing. No `specialOpeningHoursSpecification`, and no second `address`. The source did not give hours, and a midnight-to-midnight spec would be an invented clock. Standing `openingHoursSpecification` from the opening row stays, including during a `closed` notice. Search can still show those standing hours. The HTML and the availability API are the surfaces this record corrects. A later record can add a closed spec only by naming a schema.org shape that does not invent a clock.

`scheduleMarkup` is unchanged. Closed exception days keep the one-day spec they already emit. The notice does not add those days to `exceptions[]`.

### Score and cleanup

A notice is not a fact. No `facts` row, no `fact_ref`, no TTL, no source-watcher entry, and no row in `docs/facts.md`. `hasPractical` does not pass because of a notice. `stale facts` does not fail because of one. The practical points and the `no prices` string stay on the schedule, the admission rows, and the events, as ADR 0046 defines them.

[ADR 0045](0045-goal-grace-and-status-check.md) still reads the article. A notice does not excuse a closure sentence in prose. The content pass deletes that sentence. It does not widen `fact_repeated`.

The public read hides a row the day after `to`. The nightly job claims `analytics_runs` kind `notice-expire` and sets `expired_at` where `to` is before today in `Europe/Kaliningrad` and `expired_at` is null. It does not delete. There is no new `verification_queue` reason, so this record does not edit the ADR 0033 reason list. Cleanup is `notices_list` with `expired: true`, then a `notices_set` that omits those rows. `content_guide` says that list is the cleanup, not `queue_list`.

An open-ended row whose `checked_at` is more than 30 days ago is returned by `notices_list` with `needsCheck: true`. It still shows. It does not fail the score. A dated row is not `needsCheck` merely because `checked_at` is old: it hides on its own after `to`.

### Writers

MCP, audited, one writer shared with `/admin`. Tools: `notices_get`, `notices_set`, `notices_list`. `notices_set` replaces the list for that subject. A sent `id` updates that row. A row without `id` is inserted. A stored id missing from the payload is deleted. An empty array clears the subject. Omitting the tool leaves the rows alone. The editor token writes the live table. The draft token cannot publish.

Draft token, by the same live-row rule as a place or venue article:

- The parent is a draft or a review (a place in `draft` or `review`, a venue in `draft`): the write hits the live table. There is no `content_drafts` row.
- A published or archived place, or a published or closed venue: the list is stored on the existing `content_drafts` payload under `notices`, with `noticesStagedAt`. The live table, the address, the schedule, and the public page stay. A later `notices_set` replaces that key only. Other keys stay. The response is the stored draft, `pendingReview: true`, and the live publication status.
- An archived venue is 409, `The live page was not changed`, and the payload is unchanged. Same as ADR 0047.
- `place_get` and `venue_get` return the live notices. `pendingReview` includes `notices` when that key is staged. The public page does not.

Apply is the editor `content_set_publication` with `published` and no other fields. It writes the staged list through this same writer and does not change publication status. A venue stays published or closed. The place column writer never sees the `notices` key. Apply matches the draft id and `updated_at`, as it does today. Discard deletes the draft and leaves the live notices.

An editor `notices_set` writes the live table and deletes the whole pending draft in that transaction, the same as an editor `schedule_set` on a venue. The admin form still refuses a save while a draft exists until the editor discards it. The form shows each notice, live beside draft, on the place and venue edit pages.

The owner cabinet does not edit notices. An owner save of hours, the stored address, or modules does not read, merge, or delete the draft, and it does not touch `notices`. Apply of `notices` does not write an address fact, so an owner address revision does not block that key.

A guest correction stays a `guest_report`. It does not write a notice. `fact_update` is not a writer for this, because there is no fact.

### Worked rows

These are the shapes a later content pass would send. They are not seeds and they are not written by this record.

Insterburg, one row: `relocation`, `from` 2026-11-01, `to` 2026-11-13, `address` «ул. Ленина, 5А», `text` a short sentence that the cafe works at that address, `source_url` the VK post above. No hours. The stored address and the pin stay. Before 2026-11-01 the banner is upcoming. From 2026-11-14 the row is hidden.

Georgenburg, one row: `renovation`, `from` the day the source supports or else `checked_at`, `to` 2027-04-30 when the source dates the opening to 2027-05-01, `text` that states the reconstruction, the opening date, and the outside view, without «пока» or «сейчас». `places.status` stays. The status chip stays on the schedule.

## Alternatives

- Extra hours, a note, or `closure.until` on the opening row. Covered under Options. Auto-expiring `mode: closed` when `until` passes would still not carry an address, and it would mix a standing closure with a notice.
- Pending notices as their own table instead of a `content_drafts` key. Places and venues already share one payload. A second pending store is a second apply path.
- Hiding the map pin, or moving it, for the window. There is no sourced coordinate for the temporary address. The pin stays.
- Emitting `specialOpeningHoursSpecification` with a midnight clock for each day of a `closed` notice. That invents hours. The existing one-day exception spec stays on the schedule only.
- Counting the notice toward `hasPractical`, or storing it as fact kind `notice`. The brief is that an expired notice is flagged for cleanup and is never a fact.
- A new `verification_queue` reason. That edits `QUEUE_REASONS`, the check constraint, and ADR 0033 in the same change. The page is already correct without it. `notices_list` is the flag.
- Letting the owner cabinet write a notice. The cabinet would then publish an unsourced sentence onto the live page. The source has to be an official URL. Editorial only, same as admission and events.
- Routes and collections in this record. A route needs a stop range before a "section closed" row means anything. A collection that repeats member notices would fill a month guide with every castle closure.

## Out of scope

- The implementation, including the migration, the tools, the renderer, and the admin diff.
- Writing the Insterburg or Georgenburg row, or any other article text. No seed and no boot task.
- Changing `rules`, `schedule_intervals`, `scheduleMarkup`, or `readShownFacts`.
- A temporary coordinate, a geocoder, and a moved pin.
- Routes, collections, quests, hubs, and regions as owners.
- A new queue reason, a fact kind, and a row in `docs/facts.md`.
- The owner cabinet, guest submissions, and `fact_update`.
- Search indexing of notice text. The page HTML carries it. `search_documents` does not gain a column in this record.
- Suppressing standing `openingHoursSpecification` during a `closed` notice.

## Consequences

Until the implementation is on `main`, pages have nowhere to put these statements except prose, which is the gap this record closes. Schedule writes, admission, events, and the venue opening draft keep the rules they already have.

A current `closed` notice makes the chip and the availability API say closed without touching the stored hours. The day after `to`, those hours apply again. A relocation does not do that, so a verified clock can still read open during the Insterburg window. The content pass must not invent hours to paper over that.

JSON-LD can keep the standing hours while the banner says closed. That is the cost of not inventing a special-hours clock.

The draft token can propose a notice on a live place or venue. The public page changes only when an editor applies it. An owner can keep editing the live card while that draft waits. An editor `notices_set` drops the whole pending draft, including an unrelated description staged beside it.

Open-ended notices do not expire. They show until a person sets `to` or deletes them. `notices_list` with `needsCheck: true` is how those rows surface after 30 days.

The Insterburg row is useful on the public site only when both the code and the applied content land before 2026-11-01. After 2026-11-13 that row has no public days left. The Georgenburg row is useful through 2027-04-30.
