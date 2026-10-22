# ADR 0047: Pending drafts for published venues

## Status

Accepted (2026-10-22). Amends [ADR 0035](0035-draft-content-token.md) and [ADR 0041](0041-collection-route-drafts.md) for a published or closed venue, and amends the draft-versus-live rule in [ADR 0046](0046-structured-practical-info.md) for the venue opening schedule and for menu prices. Refs #249, part 2.

## Context

ADR 0035 stores a draft-token write to a published or archived place in `content_drafts`. The live row stays. `place_get` returns that row as `pendingReview`. An editor `content_set_publication` with `published` and no other fields applies the payload and then deletes it. The `/admin` place form shows each changed field, live beside draft.

ADR 0041 does the same for a published or archived collection or route. It leaves a published venue on the refusal: the draft token receives 409, and nothing is stored. The same 409 covers `schedule_set` on a published or closed venue, `media_attach_to_venue`, and `fact_update` when the fact's parent is that venue. `venue_update` and `venue_prices_set` answer the same 409 (`Draft token cannot edit a published venue` and `Draft token cannot edit prices on a published venue`). A fix to a published venue cannot be drafted for review. The only path is an editor-token write, which changes the live page immediately.

`content_drafts` is already generic (`entity_type`, `entity_id`, `payload`). The check constraint allows `publication_status` `draft` or `review`. No new table is required.

Issue #249 part 1 is on main: `schedule_set` and the venue media and fact tools refuse the draft token on a published or closed venue. Part 3, the score reading legacy hours, is a separate batch. This record is part 2.

[ADR 0046](0046-structured-practical-info.md) is accepted. Practical rows are not fields of `content_drafts`. `schedule_set` on a published or closed venue stays a 409, and nothing is stored. Admission and events use that same rule. This record amends that rule for the venue opening schedule and for menu prices, and it leaves the rest of ADR 0046 as it is.

## Decision

A draft-token write to a published or closed venue is stored in `content_drafts` with `entity_type` `venue`. The live row, `venue_prices`, the schedule, the facts, and the public page stay. Repeated writes merge into that one payload. The draft token still cannot publish.

### What is staged

The payload has three keys. A key that this write does not send stays as it was. A key that has never been sent is absent, and apply leaves the live value alone.

`fields` holds venue columns from `venue_update`, validated with the same schemas as that tool, including `venueModulesSchema` for `modules` and the source cap and dedupe for `sources`:

- `name`, `kind`, `cuisineTags`, `regionSlug`
- `address`, `phone`, `latitude`, `longitude`
- `priceLevel`, `avgCheck`
- `website`, `bookingUrl`, `orderUrl`, `deliveryUrl`, `menuUrl`
- `reservation`, `takeaway`, `delivery`, `signatureDishes`
- `modules`, `description`, `sources`, `lastVerifiedAt`

`schedule` holds one schedule, or `null` when `schedule_set` is called with `remove`. The object is `{ rules, sourceUrl, verifiedAt }`, validated with `scheduleRulesSchema` and the same `sourceUrl` and `verifiedAt` checks as `schedule_set`. `rules` is the ADR 0028 shape, including an open-ended close (ADR 0042) and unknown weekdays (ADR 0044). A later `schedule_set` replaces this key. It is not merged weekday by weekday.

`prices` holds the array from `venue_prices_set`, validated with `venuePricesWriteSchema` (at most 12 rows, the same item, variant, amount, `checkedAt`, `sourceKind`, and source checks). A later call replaces the array. An empty array is a clear, not "leave the live prices". The catalog (`price_items`) is not in the payload.

`venue_update.hours` is not a fourth shape. ADR 0033 does not take new facts from `venues.hours`. On a published or closed venue the draft token receives 400 and the payload is unchanged. The caller uses `schedule_set`. The editor token still accepts `hours` and syncs the live schedule as it does today.

The stop-list runs at store time through `savePendingDraftContent`, with `publishing: false`, so a warning is returned and the draft is kept. Banned source URLs are rejected with 400 and nothing is stored. A dish `mediaId` must already be attached. This record does not attach a photo.

Each stored key remembers when it was staged. `fieldStagedAt` is a map of field name to time. `scheduleStagedAt` and `pricesStagedAt` are one time each, because those keys are replaced as a whole. A later write updates the time only for the keys it sends. `content_drafts.updated_at` still moves on every write. The owner check below uses the per-key time, not the row time.

`publication_status` on the row is `review`. That column has no venue meaning. Apply does not read it.

### What stays editor-only

The draft token receives 409 with `The live page was not changed`, and the payload is unchanged. A call that includes one of these fields stores nothing, including any other field in that same call:

- `status`, including `closed` and `archived`. `published` is still 403, `Draft token cannot publish`.
- `slug`
- `seoTitle`, `seoDescription`, `noindex`
- `socials`. A social link is what lets a VK menu price count (ADR 0039). The editor writes it on the live row.
- `osmId`. It is the import identity.
- `contactEmail`. It is the claim channel (ADR 0031) and it is not rendered.

An archived venue is the same 409, with no payload. Today `venue_update` still writes an archived row for the draft token. This record closes that. A 410 page is not a reviewable draft. `venue_delete` stays editor-only.

A venue in `draft` is written live, as a draft place is. There is no `content_drafts` row. `venue_create` is unchanged and still cannot publish.

These stay refused, and they are not stored in this payload. `media_attach_to_venue` and `fact_update` (when the parent is a published or closed venue) stay 409. `venue_listing_intro_set`, `venue_listing_modules_set`, `price_item_upsert`, and `venue_delete` stay 403 through `requireEditorContent` or the existing editor check. `venue_price_bands_recompute` is unchanged and is not a pending payload. Apply calls the same town recompute `venue_prices_set` already calls, after the prices are written. `fact_confirm` stays allowed. It writes no new value and it does not edit the draft. Quests stay on the ADR 0041 refusal.

### Apply and discard

`content_set_publication` gains `entity: venue`. The editor token calls it with `published` and no other fields. That applies the payload. It does not change `venues.status`. A closed venue stays closed. A published venue stays published. `draft` or `review` for this entity is 400. A venue with no pending row is 409, `Черновика нет`. Publishing a draft venue stays `venue_update` with the editor token.

Apply and the admin discard match the draft that was read: its id and `updated_at`, inside one transaction. A draft written after that read stays.

Apply runs the venue content gate with `publishing: true` for both a published and a closed venue. Both are public pages. A stop-list rejection writes nothing and leaves the draft. The message is the existing `Нельзя опубликовать` from `writingGate`. The field write goes through the same cleaner as `updateVenue` (`updateVenueContent`): modules, sources, and the fact sync for phone, address, and coordinates. `lastVerifiedAt` is the staged value when that field was sent.

The schedule and the prices go through the fact ledger. They are not copied in as bare columns.

- A `schedule` object calls `saveSchedule` for `entity_type` `venue` with the stored `rules`, `sourceUrl`, and `verifiedAt`. Apply does not replace `verifiedAt` with today. `saveSchedule` rebuilds `schedule_intervals` and upserts the hours fact (slot `hours`) in that same write. The fact revision actor is `editor`.
- A `schedule` of `null` deletes that schedule and retires the hours fact, the same path as `schedule_set` with `remove`.
- A `prices` array calls `setVenuePrices` with those rows, including each row's `sourceKind`, `sourceUrl`, `sourceTitle`, and `checkedAt`. The actor is `editor`. Town price bands are recomputed only after that write. They are not recomputed when the draft is stored. «Где дешевле» keeps reading live prices until then.

The public page, the venue card, and JSON-LD change only when that transaction commits.

Discard deletes the draft and leaves the live row. There is no new MCP tool for it. An editor `venue_update`, `venue_prices_set`, or `schedule_set` that changes the live venue deletes the whole pending draft in that same transaction. A write that changes nothing leaves the draft.

The `/admin` venue form (`VenueForm` on `/admin/venues/[id]`) shows the pending draft the way the place form does. The heading and the buttons stay «Черновик ждёт решения», «Применить черновик», and «Отбросить черновик». The lead is the venue sentence: «Агент сохранил правки этой страницы. На сайте по-прежнему живая карточка. Применить запишет черновик и не меняет статус. Отбросить оставит живую карточку.» Each changed field is live beside draft, including the schedule lines from `describeSchedule` and the price rows. The list shows «есть черновик». Apply calls `content_set_publication` with `entity: venue` and `published`. A save is 409, «Есть черновик. Примените его или отбросьте.», until the body sets `pendingDraft` to `discard`. That discard deletes only the draft that was checked.

### Owner cabinet

ADR 0031 stands. An owner save writes the live row immediately: modules, description, the weekly opening hours, and `venue_prices` with `sourceKind` forced to `owner`. It does not read, merge, or delete `content_drafts`. The cabinet has no pending-draft notice. The owner sees the live card, including the save they just made.

The owner wins the live page. The editorial draft keeps the staged copy. Neither save deletes the other.

Apply will not overwrite a newer owner revision of the same key. A fact revision with actor `owner`, or a `venue_audits` row with action `owner_update`, blocks a key when its time is later than that key's staged time. Hours block `schedule`. A price revision blocks the whole `prices` key, because apply replaces the list. Phone, address, and coordinates block those fields. An owner edit of description, modules, name, links, or the other staged columns blocks that field. An owner edit of `socials` or a photo does not block apply: those are not in the payload.

Clear keys are written. Blocked keys stay in the draft, and the response lists them as `ownerConflicts`. The draft is deleted only when nothing remains. If every key is blocked, apply returns 409, writes nothing, and leaves the draft. The notice shows the remaining pairs, so the live column is the owner's newer value. The editor discards, or sends a new draft-token write for that key, which restages it.

The editor apply that does write uses actor `editor`. That is not a content-token overwrite. ADR 0033 still stops the draft token from writing over an owner fact on the live row: the draft token never calls `saveSchedule` or `setVenuePrices` on a published or closed venue. It only stores the payload.

### Responses

`venue_get` returns the live venue, for either token. `pendingReview` is `null`, or the stored payload plus `id`, `updatedAt`, `changedFields`, and `pendingPublicationStatus: 'review'`. `changedFields` lists staged keys that differ from live. `status` in the response stays the live status. The public page does not include `pendingReview`.

`venue_update`, `venue_prices_set`, and `schedule_set` for the venue opening row on a published or closed venue store instead of answering 409. The response is the stored draft: `pendingReview: true`, `changedFields`, `writingWarnings`, and `descriptionLength` when `description` is staged. `status` stays the live status. `schedule_set` on a place is unchanged (409 on a published or archived place). A venue `schedule_set` with any other `kind` or `slot` stays 409 (ADR 0046). `schedule_set` on a draft venue still writes the live schedule.

`content_score_preview` scores a venue from this payload the same way it scores a place, and it does not write `content_scores`. The stored score and the public page keep reading the live row. The legacy-hours flag in the score is issue #249 part 3 and is not decided here.

### Structured practical info

ADR 0046 keeps practical rows out of `content_drafts`. The draft token receives 409 on a published or closed venue, and on a published or archived place or route, and nothing is stored. That covers every schedule kind, `admission_set`, and `event_upsert`. A pending copy of those rows was considered and rejected there.

This record amends that paragraph for two keys on a venue, because a published venue otherwise has no reviewable copy (#249, part 2):

- The staged `schedule` is the opening row. `schedule_set` without `kind` and `slot` is that row (`opening` / `main`). Apply calls `saveSchedule` for it with the stored `rules`, `sourceUrl`, and `verifiedAt`, and upserts the hours fact in slot `hours`. When the ADR 0046 writer exists, apply calls that writer for `opening` / `main` only and leaves every other kind on the venue untouched. A draft-token `schedule_set` that sends any other `kind` or `slot` is 409 and is not stored.
- `prices` is `venue_prices`, the menu list. ADR 0046 keeps that list a different family from admission. Staging it does not make a museum ticket a catalog item, and it does not let the owner cabinet write admission.

Box office, sessions, seasonal rows, admission, and events stay on the ADR 0046 rule: 409, nothing stored. This payload has no keys for them. The ADR 0046 content pass on a published page still uses the editor token for those rows. The owner cabinet still edits only the opening row, and a content-token write still does not overwrite an opening fact whose latest actor is `owner`. The draft token never calls `saveSchedule` on the live row. It only stores the payload. Until the ADR 0046 columns exist, the venue still has the one schedule row it has today, and apply uses `saveSchedule` as written above.

### Alternatives

- Leave the 409 and review the venue out of band. That is the gap in #249: the agent cannot propose the fix, and the editor token writes the live page before review.
- Pending rows on `schedules` and `venue_prices` instead of one payload. The editor could apply one and not the other. Places, routes, and collections already share `content_drafts`.
- A pending flag on the fact, with readers hiding it. Readers fall back to the column when the fact is missing, so a hidden fact and a live column disagree, and JSON-LD is easy to get wrong.
- Hold owner saves until the editorial draft is applied. ADR 0031 refused that. A wrong hour would stay wrong for the whole review.
- Show the editorial draft in the cabinet. The cabinet is the owner's live card. Mixing the two lets the owner publish agent copy, or lets an apply look like the owner's own text.

### Out of scope

- The implementation. The file list is below.
- Photos, captions, and `fact_update` on a live venue.
- Quests, listings, the price catalog, and `venue_delete`.
- Guest corrections. They stay a `guest_report` (ADR 0036) and do not write this payload.
- Issue #249 part 3, the score reading legacy hours.
- Ticket prices, extra schedule kinds, and events. Their draft-versus-live rule is ADR 0046.
- A new migration. `content_drafts` already stores a venue id.

### Follow-up implementation

- `apps/web-app/server/utils/venues/write.ts`: store a published or closed venue instead of 409; archived becomes 409; an editor write that changes the row deletes the draft.
- `apps/web-app/server/mcp/tools/venue-update.ts`, `venue-prices-set.ts`, `venue-get.ts`, and `schedule-set.ts`, plus `server/utils/mcp/schedule-target.ts` and `server/utils/mcp/pending.ts`: merge, validate, and return `pendingReview`.
- `apps/web-app/server/utils/mcp/publish.ts` and `server/mcp/tools/content-set-publication.ts`: `entity: venue` applies and does not change status.
- `apps/web-app/server/utils/schedule.ts` and `server/utils/facts/sync.ts`: apply passes the stored source and verified date into `saveSchedule` and `setVenuePrices` with actor `editor`; the per-key owner check runs first.
- `apps/web-app/server/utils/content/save.ts`: `savePendingDraftContent` for the venue gate, and apply syncs sections only after the live write.
- `apps/web-app/server/utils/admin/content-draft.ts`, `app/components/admin/VenueForm.vue`, `app/pages/admin/venues/[id].vue`, and `app/pages/admin/venues/index.vue`: the notice, apply, discard, and the save guard.
- `apps/web-app/server/mcp/index.ts` and `server/utils/mcp/guide.ts`: the draft token stores a published or closed venue instead of refusing it.
- `AGENTS.md`, and the "amended by" lines on ADR 0035 and ADR 0041, once this record is accepted.
- Tests beside `packages/database/src/repository/test/pending-publish.test.ts`: the draft token stores and the live row, prices, schedule, and facts stay; repeated writes merge and do not refresh another key's staged time; `venue_get` returns `pendingReview`; editor apply writes `saveSchedule` and `setVenuePrices` with the stored source and dates, leaves status unchanged, recomputes bands, and deletes the draft; a newer owner revision leaves that key staged; an owner save does not delete the draft; editor-only fields, archived, photos, `fact_update`, and a schedule kind other than opening stay 409; publish stays 403; a draft-status venue still writes live; admin save is 409 until discard, and discard matches id and `updated_at`.

## Consequences

An agent with the draft token can propose a correction to a published or closed venue, including the description, the modules, the sources, the menu prices, and the opening schedule. It still cannot publish that correction, and it cannot change the slug, the status, the SEO fields, or the social links.

The public page is unchanged until an editor applies the draft. An owner can keep editing the live card while that draft waits. Apply will not silently replace an owner edit that is newer than the staged key.

Until the implementation lands, the draft token's answer on a published venue remains the 409 this record replaces.
