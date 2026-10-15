# ADR 0031: Personal cabinet and venue claims

## Status

Accepted.

## Context

The site already signs people in with Yandex ID or VK ID and stores a versioned consent row (ADR 0005, `user_consents`). Venues are a catalog, not accounts (ADR 0018). `businesses.owner_user_id` and `offers.venue_id` were left for a later paid cabinet (ADR 0017). The venue page asks the owner to email the editorial desk. There is no place where that person can sign in and edit their own card.

A venue page is an ordered list of modules in `venues.modules` (`docs/venue-modules.md`, the same idea as ADR 0023). `venue_update.modules` validates that list with `venueModulesSchema`. «Ориентиры цен» is not a second price table: the `prices` module reads `venue_prices`, written by `venue_prices_set` against the shared `price_items` catalog. Owner edits must use those two checks, not a parallel shape. Hours stay on the schedule (ADR 0028). Photos stay on `venue_media`.

There is no mail or SMS service in this app. A code that the product only prints in a log is not verification.

## Decision

### One user, a role per venue

`users` stays one person. The site role (`user`, `editor`, `admin`) is the editorial staff of K39. It does not make someone the owner of a cafe.

`venue_members` is the grant: `user_id`, `venue_id`, `role` of `owner` or `editor`. A user may sit on many venues. A venue has at most one owner. Editors are in the table so a later invite does not need a migration. This version only creates owners, through a verified claim. There is no invite UI.

`businesses.venue_id` is a nullable unique link. A later subscription or ad offer attaches there, or to the existing `offers.venue_id` / `offers.business_id`. This record does not bill anyone and does not create offers.

### Claim

A signed-in user opens «Это моё заведение» on the public venue page, or searches the published catalog in `/kabinet`. Drafts and archived rows are not claimable and are not in that search. The public page renders the same card for everyone. The cabinet is `noindex` and disallowed in `robots.txt`.

`venue_claims` stores `pending`, `verified`, `rejected`, or `withdrawn`, the channel (`email`, `phone`, `manual`), and, for a code, only a hash. One open claim per user and venue. Verifying a claim inserts the owner row and rejects every other pending claim on that venue. A second owner insert loses to the unique index.

### Verification

No one becomes an owner by submitting the form.

- **Email code.** Only when `venues.contact_email` is already stored (OSM `email` / `contact:email`, or an editor). The server draws a 6-digit code, stores `SHA-256(pepper + venue + user + code)` with the session password as pepper, and POSTs it to `CLAIM_EMAIL_URL` over HTTPS. The response to the browser never includes the code. Five wrong tries clear the hash. It expires after 15 minutes.
- **Phone code.** The same, to `CLAIM_SMS_URL`, when `venues.phone` already has at least ten digits.
- If that URL is unset, the channel is off. The cabinet says so and offers the manual queue. The server does not invent a delivery.
- **Manual.** The person writes what proves they represent the venue (20–2000 characters). An editor approves or rejects it in `/admin/claims`. Approval requires an explicit confirmation in the request. The admin sees the evidence and the address the code would have used. The public site does not.

Rate limits, per user: five claim starts and five code sends per hour, ten code checks per 15 minutes, thirty searches and thirty saves per minute, ten photo uploads per hour. The counters are process-local, the same idea as the content API limit.

### What an owner may change

Owners and venue editors may change the blocks in `docs/venue-modules.md`: the stored modules (`venueModulesSchema`, including `text`, `dishes`, `audience`, `practical`, `best-time`, `how-to-get`, `tips`, `prices`, and `faq`), name, description, cuisine, address, phone, website, socials, booking / order / delivery / menu links, reservation and service flags, signature dishes, price level, average bill, weekly hours, and photos.

«Ориентиры цен» is `venue_prices`. The cabinet sends the same object as `venue_prices_set` (`item`, `variant`, `priceRub`, `checkedAt`, `sourceTitle`). The server forces `sourceKind` to `owner` and drops `sourceUrl`, so an owner cannot mark a row official or attach an aggregator link. Unknown catalog slugs fail the whole write, as they do for the content token. The owner does not edit `price_items`.

They may not change status, slug, kind, region, coordinates, OSM id, sources, SEO fields, or `noindex`. Those stay with the desk, so a claim cannot unpublish the page, move the pin, or swap the URL.

Hours are saved with the venue write and then through `syncVenueSchedule`, so `schedules` and `schedule_intervals` (ADR 0028) stay the source for «открыто сейчас». Saving hours sets `last_verified_at` and the schedule verified date. Saving a phone number does not mark an untouched schedule as checked. The weekly table is the cabinet editor. Seasonal rules remain `schedule_set`.

The column write is `Venues.update` after the same field cleaning as `venue_update`. `modules` is parsed with `venueModulesSchema` before that call. Unknown keys are dropped.

### Photos

An owner upload goes through the existing image pipeline (type and the 25 MB cap). The client must send `rights=1`. Origin is forced to `venue` («от заведения»). License is `permission`. Author is the name they type, falling back to the account name. They may delete only a photo whose origin is `venue`. Editorial and Commons photos stay.

`contact_email` is not rendered on the public page. It is a verification address, not a listing field.

### Moderation of edits

Verified edits go live. Hours and a menu link are wrong the whole time they sit in a queue, and the person was already checked. Every `Venues.update` already inserts a `revisions` snapshot of the previous row, with `updated_by` set to the actor. `/admin/venues/{id}` lists those snapshots and can restore one. The restore is itself a new revision. `venue_audits` records the action and the field names, never a code and never the raw verification address.

Pending claims are approved or rejected in `/admin/claims`. A live page is put back by restoring a revision. Removing a member is not in this version.

### Provenance

- Public copy comes from the venue row, the same HTML for a browser and a bot.
- `revisions.snapshot` is the row before the write. `updated_by` is who replaced it.
- `venue_audits.action` is `claim_verified`, `claim_rejected`, `owner_update`, `photo_upload`, `photo_delete`, or `revert`.
- `venue_media.origin = venue` marks owner photos. Author and license stay on `media`.
- MCP writes are still `mcp_audits` and are not relabelled as the owner.

### Cabinet shell

`/kabinet` is the page behind «Войти». It shows the person's name and email, the active consent version, a logout link, the venues they manage, and the search. Someone with no venue still has that page. Editors and admins see «Кабинет» and «Админка». `/sign-in?redirectTo=` accepts only a single-slash path.

## Consequences

A cafe can take its page without a subscription. Offers and billing stay on the roadmap; `businesses.venue_id` is the hook. Email and SMS codes work only after the delivery URL is set. Until then the real path is the admin queue. Owner edits can be wrong the moment they are saved; the change log is how the desk undoes them. Process-local rate limits reset on deploy and are not shared across instances.

## Deferred

- Subscriptions, invoices, and auction bids.
- Creating and pausing offers from the cabinet.
- Inviting a venue editor.
- Deleting a member from `/admin`.
- A seasonal hours editor in the cabinet.
- Owner edits to slug, status, map pin, kind, region, SEO.
- Delivery of codes when `CLAIM_EMAIL_URL` or `CLAIM_SMS_URL` is empty.
