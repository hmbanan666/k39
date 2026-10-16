# ADR 0036: Guest submissions

## Status

Accepted.

Owner answers on 2026-10-16 are under Resolved. This record does not add tables, routes, or copy. The build is a later change.

## Context

The public page is editorial. A place or a venue is written, sourced, and published by the desk (ADR 0007, ADR 0035 draft token). Hours, phone, address, coordinates, status, and price are typed facts (ADR 0033). The page shows a fact through `readShownFacts`, or the legacy column when that fact is missing. A guest sentence is not one of those sources.

People can already sign in with Yandex or VK (ADR 0005). Sign-in records a versioned row in `user_consents`. The current version is `CONSENT_VERSION` (`2026-10-12`) and the method is `sign-in-button`. The text is the separate page `/soglasie`. It covers the name, email, profile image, and provider id, for registration, the cabinet, and contact. It is not part of `/privacy` or `/terms`. Clicking the sign-in button records it. There is no checkbox. `/admin/consents` can mark a row withdrawn and does not delete it.

`/privacy`, `/terms`, and `/soglasie` are dated 12 октября 2026 года. The operator block comes from `apps/web-app/shared/operator.ts`. Terms still say the site is free and needs no account, and they already accept an email when a page is wrong or a photo right is disputed. Privacy already answers a personal-data request within 10 business days, stores data in Russia, and does not transfer it abroad.

A venue owner is a different grant. `venue_members` lets a verified claimant edit that venue's modules, weekly hours, owner prices, and photos (ADR 0031). Those writes go live. Hours and prices upsert facts with actor `owner`. The content token does not overwrite a fact whose latest revision actor is `owner`. Owner photos use origin `venue` and license `permission`, through the same image pipeline as editorial uploads (ADR 0011). They are not the dish-showcase cover (ADR 0032).

ADR 0032 deferred guest reviews and guest food photos and said they belong to the venue, not to a dish id. Nothing in the schema stores them. `page_reviews` is the editorial section-hash ledger from ADR 0033. It is not a visitor review.

`verification_queue` is the only fact and section work list. ADR 0033 names the reasons the watcher and the save path insert. The table has since gained `owner_conflict`, `fact_repeated`, and a `proposal` jsonb. Agents still do not invent facts from a page scan. `fact_confirm` and `fact_update` close that fact's open queue rows. There is no `guest` actor and no `guest` source kind.

Analytics stay cookieless and carry no account id (ADR 0013). `POST /api/events` stores no IP (ADR 0004). The editorial stop-list in `apps/web-app/shared/writing.ts` is the voice of the guide. Visitor speech will not pass it, and it should not have to.

The catalog is on its way to thousands of pages. A guest block has to stay a bounded query on the page that already exists.

## Decision

Guests may send four kinds of material about a published place or a published venue: a review, a tip, a photo, and a correction. The first three can be shown, attributed, under the editorial article. A correction is a signal on `verification_queue`. It never becomes the shown fact, and it never appears on the public page.

Venue-owner edits stay on the ADR 0031 path. This record does not route them through the guest queue.

### Who may send

A signed-in user whose account consent is still active, and who accepts the separate guest-content consent in the same submit. The role is `user`. Editors and admins change the page from the desk. They do not use this form.

The subject is a published place or a published venue. Drafts, archived rows, routes, collections, quests, hubs, and listing pages are not targets.

A `venue_members` row for that venue cannot send a review, a tip, or a photo of it. The cabinet is how that person speaks for the venue. They may still send those three kinds about any other published place or venue, as a visitor. A correction of phone, address, hours, or prices on their own venue is refused with a pointer to the cabinet. A correction of operating status is allowed, because status stays editorial (ADR 0031).

### What they send

One submit is one kind. A review and a photo of the same visit are two rows, so a moderator can refuse the file and keep the text.

| Kind | Public | Body | Cap per user and subject |
| --- | --- | --- | --- |
| `review` | After accept | Plain text, 80–1200 characters | One accepted. A new one waits until they remove the old |
| `tip` | After accept | Plain text, 40–400 characters | One accepted, same replacement rule |
| `photo` | After accept | A file plus alt text, 10–140 characters | Three accepted |
| `correction` | Never | A kind, a short value (1–120 characters), an optional note (0–400), an optional https URL | One pending. Further accepted rows only add signals |

Correction kinds in this version: `hours`, `phone`, `address`, `status`, `price`, `other`. Coordinates stay with the desk. A price report is a signal only. `venue_prices` changes later, from the official menu, as under Corrections.

Text is plain. The server stores no HTML and no markdown. A review or a tip may contain one `https` URL. Any other URL, an email address, or a phone number refuses the submit, so a guest does not put someone else's contact details on the page. The correction URL is stored for the editor and is not rendered.

The editorial stop-list is not applied. «Уютно» is a visitor's word. The mechanical refuse list is smaller and lives in one module when this is built:

- A host in `WRITING_BANNED_SITES`, and a URL that is not `https`, that has userinfo, or that is not a public web URL.
- An email address or a phone number in the text.
- A second pending row of the same kind for the same user and subject.
- A normalized duplicate body (trim, collapse whitespace, lower case) of a pending or accepted review or tip on that subject.

Rate limits follow the cabinet: process-local, per user. Five submits an hour, ten photo uploads an hour. They reset on deploy and are not shared across instances (ADR 0031). That is accepted. This record does not add Redis.

### How a row is stored

`guest_submissions` is the table. It is not `page_reviews` and not a fact.

Columns: `user_id`, `subject_type` (`place` or `venue`), `subject_id`, `kind`, `status` (`pending`, `accepted`, `rejected`, `removed`), `body`, `alt`, `correction_kind`, `correction_value`, `source_url`, `media_id`, `decided_by`, `decided_at`, `decision_note`, timestamps.

`decision_note` is shown to the author in `/kabinet` when the status is `rejected`. It is not public.

No IP column. No provider id. Email stays on `users` and is not copied here. The public byline is derived at render time from the current `users.name`: the first word, then the initial of the last word and a period («Анна Косарева» and «Анна Ивановна Косарева» both show «Анна К.»). A one-word name is shown as that word. The full account name is not stored on the submission, not rendered, and not put in JSON-LD. A renamed account updates the byline. A removed account cannot leave a name behind.

An audit row records the action, the submission id, the actor, and the time. It does not store the body, the email, or the file. Same rule as `venue_audits`.

### Shown apart from the guide

Accepted reviews, tips, and photos render in one server-rendered section, the same HTML for a browser and a bot. The heading is «От гостей». It sits after the editorial article, the FAQ, and «Источники», as a sibling of that article. On a venue it sits after the full-width «Источники» block. An empty section is omitted.

The line under the heading says these are visitor messages, that the desk did not check them as facts, and that hours and prices on the page stay the sourced ones.

Each item shows the byline, the accept date in `Europe/Kaliningrad`, and a kind label («Отзыв», «Совет», «Фото гостя»). No avatar image. The profile image from Yandex or VK is a third-party request and is not loaded. No stars, no likes, no reply, no thread.

The section is capped at the newest 30 reviews, 10 tips, and 12 photos. Older accepted rows stay in the database and in the author's cabinet. They do not add a page, a query parameter, or a second canonical.

Guest text is not written into the summary, the body, the modules, the FAQ, `sources`, `seoTitle`, or `seoDescription`. `search_documents` stays the editorial view (ADR 0030). The content score ignores the guest section for length, the stop-list, and facts. `readShownFacts` does not read it. JSON-LD `description`, `openingHours`, `telephone`, `address`, and `image` stay editorial.

A guest photo is not attached to a dish id (ADR 0032). It is not `place_media` or `venue_media`, not the cover, and not `og:image`.

### Moderation

Nothing of the four kinds is public while `pending`. Accept is what shows a review, a tip, or a photo, and what releases a correction into the fact queue.

The queue is `/admin/guests`. The public page is linked beside the text or the photo. Reject stores `decision_note` for the author.

Once a day the K39 Grok Bot assistant works the pending rows, oldest first. It accepts or rejects a clear row. Accept: the text is a visit note, a tip, or a plain correction, or the photo is of this place and shows no recognizable face. Reject: spam, advertising, illegal content, a copied page, a photo of somewhere else, or a recognizable face. A face is always a reject. A guest's statement that someone else agreed is not a reason to accept, and it is not a dispute. That consent cannot be checked, and 152-FZ does not let the site rely on it.

A disputed row stays `pending`. The bot escalates only those to the owner, who decides them in `/admin/guests`. Disputed means the bot cannot tell whether the text is a real visit note or spam, or whether a photo is this place, or a rights complaint is already attached to the row. A clear price report is not a dispute. Accepting it only puts the signal on the fact queue. The menu check is that later step, and the bot does not write `venue_prices`.

The editorial publish checklist (`k39-publish-review`) is a different pass and does not run on guest rows. Guests do not submit through the content MCP. The draft token cannot moderate a guest row. The editor token moderates pending rows with the tools in ADR 0040. Those tools call the same writer as `/admin/guests`.

A rejected or removed row can be replaced by a new submit. There is no in-place edit of an accepted row. The author removes it and sends another, which waits again.

Mail is not sent on accept or reject. `/kabinet` shows the status. Claim delivery URLs stay on the claim flow.

### Corrections and the fact layer

Accepting a correction writes a signal. It does not write `facts`, `fact_revisions`, `schedules`, `venue_prices`, or a column.

The new queue reason is `guest_report`. It is added to `verification_queue_reason_check`. `Facts.enqueue` already upserts an open row of the same target and reason and replaces `proposal`.

- When a live fact matches `(kind, subject_type, subject_id, slot)`, upsert one open `verification_queue` row with `target = fact`, that `fact_id`, and reason `guest_report`. `proposal` holds the latest submission id, the guest text, the optional URL, and a count. A second accepted correction for the same fact increments the count and replaces the latest text. The unique open row per fact and reason already enforces this.
- When no live fact matches, upsert one open row with `target = section`, the page, path `guest:{kind}`, and the same reason. `other` uses path `guest:other`. A price report that names one live price fact targets that fact. Any other price report uses path `guest:price`.

A price signal does not write `venue_prices`, `facts`, or a price revision. The number on the page changes only after a check against the official menu (`k39-sources-and-facts`, `k39-price-anchors`): a page or a PDF on the venue's site. The guest's number, a map card, and an aggregator are not that source. The write is the existing price path, with `source_kind` official and that menu URL. If the menu still matches the stored price, `fact_confirm` closes the queue row and `venue_prices` stays. An owner-set price is still not overwritten by the content token. That conflict waits in `/admin`.

Priority uses risk 1, the prose weight from ADR 0033: `1 × round(ln(1 + traffic))`. The count does not multiply priority. A pile of reports must not outrank `source_changed` on hours.

The latest revision actor may be `owner`. The signal is still queued so the owner can see the disagreement. `fact_update` keeps refusing that overwrite. The conflict stays in `/admin`. This path does not insert `owner_conflict` by itself.

An agent starts at `queue_list`, reads `proposal` as a hint, and checks an allowed source (`k39-sources-and-facts`). The guest text and the guest URL are not a source. `source_kind` does not gain `guest`. Actor does not gain `guest`. `fact_confirm` of the current hash, or `fact_update` from a real source, closes that fact's queue rows, including `guest_report`. Confirming without adopting the hint is a valid close. A section-targeted `guest:*` row is resolved from `/admin/guests` when the owner dismisses it, and also when a matching fact row is written for that page, so the two signals do not both stay open.

The public page keeps showing the verified fact the whole time.

### Photos and the license

The file goes through the existing pipeline (ADR 0011): JPEG, PNG, or WebP, 25 MB, EXIF dropped, including GPS, variants under `MEDIA_DIR/{id}/`. HEIC is refused. No upload-from-URL and no Commons import on this path.

`media.license` gains `guest`. That value is only this path. `own` stays a K39 shot. `permission` stays a cabinet upload with origin `venue`. The public author is the byline, not a name typed in the form and not the full `users.name`. `sourceUrl` is null. Alt is the guest's plain text.

The client sends `rights=1`, the same shape as the cabinet photo post. That flag is the guest's statement of all of the following:

- They took the photograph.
- It is not a copy from a website, a map card, a guide, or a messenger.
- They grant K39 a non-exclusive, royalty-free license to show it on k39.online and to make the technical copies the pipeline already makes (resize, AVIF, WebP, LQIP).
- The license lasts until they remove the photo or the desk removes it. They keep the copyright. K39 does not sublicense the photo except to the host that serves the file.
- The frame does not contain a recognizable person.

A missing `rights=1` stores nothing.

A recognizable face is always a reject, including when the guest writes that the person agreed. The form does not ask for a third party's consent. The bot and the owner both refuse the file.

### Personal data and the other legal pages

152-FZ already splits the account consent from the policy and the terms. Guest content is a new purpose, so it gets its own versioned consent. `CONSENT_VERSION` stays the sign-in text. Sign-in does not start asking again.

The new constant is a distinct version string, dated the day the Russian text is published, stored in the same `user_consents` table with method `ugc-submit`. The unique active key is `(user_id, version)`, so the string must not collide with `2026-10-12`. The page is a new legal route, linked from the submit control and from `/privacy`, and kept out of the footer, the same way `/soglasie` is kept out. The operator block comes from `operator.ts`.

The consent names: the public byline (first name and the initial of the last name), which is what visitors and the page source see; the text; the photo; the account id that ties them together; the time. It states that the full account name, the email, and the provider id are not published. Purposes: take the submission, moderate it, show an accepted review, tip, or photo, and handle a removal request. Actions match the account consent, plus publication of the byline and the material. Term: until withdrawal or deletion of the account. Withdrawal is an email to the operator, the address already on those pages. No cross-border transfer. Hosting stays in Russia. The text is specific, separate, and not buried in the policy or the terms.

`/privacy` gets a new dated edition when this ships. It adds submissions to the data and purposes, points at the new consent for the public name, and leaves the account consent where it is.

`/terms` gains a user-content section. Reading the site stays open without an account. Sending one of the four kinds requires an account. The section carries the license in the photo bullet above, the guest's warranty that the text is theirs and the photo is theirs, a ban on illegal content, other people's personal data, advertising, and copies, the statement that guest text is not the guide's statement, and that a submission is unpaid. The operator may refuse or remove.

Removal:

- The author removes their own row in `/kabinet`. Status becomes `removed`. The body, the correction value, and the note are cleared. Media files are deleted from `MEDIA_DIR`. The byline disappears on the next render.
- A third party uses the email already in terms 6.1 and privacy 8.2. The 10 business days already stated there still apply. A credible copyright or image complaint takes the row off the public page first. The editor then confirms the removal or restores it.
- Withdrawal of the `ugc-submit` consent removes every submission of that user by the same clear-and-delete path. Withdrawal of the account consent is still an account matter. Deleting the user runs the same path first. A foreign key is not what deletes files on disk.
- `/admin/consents` keeps the withdrawn row, as it does today.

Pre-moderation is a quality gate. Because an editor chooses what is published, this record does not treat K39 as a mere conduit under Civil Code 1253.1. The guest's warranty and a takedown on complaint are the controls. 236-FZ is out of scope: this is not a social network, and the product does not take on that statute's duties.

### SEO

The canonical URL, the sitemap row, and the indexability of the place or venue do not change. Guest material does not create `/otzyvy`, `/user`, or a per-item URL. A query string is not added.

The one `https` URL in a review or a tip is an anchor whose text is the hostname. `rel` is `ugc nofollow`, plus `noopener` and `noreferrer`. The correction URL is not a link on the page.

JSON-LD gains a `Review` for each review that is actually in the HTML, attached to the existing place or venue `@id`. Fields: `author` as `Person` with the byline only, `datePublished`, `reviewBody`, `inLanguage: ru`, `itemReviewed`. No `reviewRating`, no `aggregateRating`, no `ratingCount`, no author `url`, no author image. Tips, photos, and corrections are not `Review`. Guest photos are not added to the entity's `image` array. `Review` has to be added to `SCHEMA_TYPES` in `apps/web-app/shared/seo.ts` when this is built, or `schemaProblems` will fail the page. `AggregateRating` is not added.

Yandex and Google both see the visible text and the `nofollow` links. Stars are not requested.

### Scale

The public cost of a page is one indexed read of accepted rows for that subject, with the caps above. The HTML size stays bounded on a popular fort or a popular cafe.

`verification_queue` grows by at most one open `guest_report` per fact, plus one open `guest:*` section row per page and kind. Extra corrections do not insert extra queue rows.

Postgres is the store. Photo bytes stay on the existing media volume. No second queue service, no search index of guest text, no classifier, no mailer.

What grows with success is the pending queue, not the schema. The caps and the duplicate hash keep a day's rows readable. The bot clears the clear ones. The owner sees the disputes. A later auto-publish rule is a new record, after this one has been used.

### Out of scope

- Star ratings and aggregate scores.
- Anonymous, email-only, or staff submits.
- Threads, replies, likes, profiles, follows, and direct messages.
- Importing reviews or photos from Yandex, 2GIS, Google, or another guide.
- Guest edits to editorial prose, modules, sources, the map pin, or the route line.
- A guest value written straight onto a fact, a schedule, or `venue_prices`.
- Guest photos as cover, OG image, or a dish `mediaId`.
- Applying `WRITING_STOP_LIST` to visitor text.
- Folding ADR 0031 owner edits into this queue.
- Showing a correction, including a price report, on the public page.
- Publishing the full account name. The public line is the byline.
- Treating a guest's statement of someone else's consent as a reason to publish a face.
- MCP submit tools. Editor-token moderation is ADR 0040. The draft token still cannot approve, reject, or flag a guest row.
- An agent that turns `proposal` into `fact_update` without an allowed source.
- Paying for a submission, badges, or points.
- Rewriting guest text with a model.
- A second image pipeline.
- Publishing first and moderating after.
- A social-network product, and the duties of 236-FZ.
- Joining the analytics visitor key to `user_id`.

## Consequences

When this is built, a visitor can leave a moderated, attributed note or photo without that note becoming the guide's voice or the phone number on the page. The public name is the byline. A correction, including a wrong price, can move a fact up the existing queue. The shown value still changes only through `fact_update`, the official-menu price path, or the cabinet.

The legal pages and the new consent ship in the same change as the form. Until that consent version exists, the submit endpoint stores nothing.

ADR 0032's deferral of venue-level guest reviews and guest photos is the scope this record takes up. Dish ids stay out of it. `page_reviews` stays the editorial hash ledger.

Process-local rate limits remain a per-instance ceiling. A determined sender with many accounts still lands in `/admin/guests` as pending. The daily bot pass is what clears the clear rows. The owner sees the rest.

## Resolved

Owner answers, 2026-10-16:

1. The public byline is the first name and the initial of the last name («Анна К.»). The full account name is not published.
2. A photo with a recognizable face is always rejected. A guest cannot clear that by stating a third party's consent. That consent cannot be checked, and 152-FZ does not allow the site to rely on it.
3. The K39 Grok Bot assistant processes `/admin/guests` daily. It escalates only disputed items to the owner.
4. A guest report of a wrong price is a `guest_report` signal on `verification_queue`. `venue_prices` changes only after a check against the official menu.
