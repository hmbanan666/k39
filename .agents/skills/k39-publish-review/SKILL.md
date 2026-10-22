---
name: k39-publish-review
description: Use before publishing a K39 place, venue, route, collection, quest, or hub. Run the author checklist, then a review by a different agent in a separate session, and publish only after that pass.
---

# K39 publish review

Two passes. The author does not publish in the same pass that wrote the page. `content_guide` states the same rule.

Voice: `k39-writing`. Facts: `k39-sources-and-facts`. Prices: `k39-price-anchors`. Venue shape: `k39-venue-page`.

## Author pass

Save a draft. Then read the stored row (`place_get`, `venue_get`, `route_get`, `collection_get`, `quest_get`), not the text still in the chat.

1. Run the checklist in the skill for this page type.
2. Call `content_score_get` for the path. Fix quality failures you can fix without inventing a fact.
3. Stop. Places, routes, collections, and quests: move to `review` (`place_submit_review` or `content_set_publication`). Venues have no review status: leave `draft`. Hubs go live on `hub_update`, so do not send the public body until the reviewer pass.

## Reviewer pass

A different agent, in a separate session. The author does not review their own draft, including in a later turn of the same session. Verification starts at `queue_list` for this page, then the reviewer loads the stored page. `fact_get` reads a queued fact. `fact_confirm` is only for a hash that still matches. `fact_update` does not overwrite a fact whose latest revision actor is owner: that conflict waits in `/admin`. `page_mark_reviewed` stores section hashes after the prose is accepted. A fact confirm does not mark prose reviewed.

Reject, with the failing lines, when any of these fail:

- Stop-list. Search `WRITING_STOP_LIST` and `WRITING_STOP_PATTERNS` in `apps/web-app/shared/writing.ts`, including inflected forms («идеальный», «идеальны», «самого»), «каждый найдет» without ё, triads, «не просто X, а Y», and an em dash. On a collection that renders modules, search the module text. `body` there is the projection of the modules, not a second article. `renderedFields` on the save says which fields show.
- Facts. Every number, date, hour, and price has an allowed source. For a venue that exists and operates, address, hours, phone, operating status, and coordinates follow `k39-sources-and-facts`: official site, then Yandex Maps, 2GIS, Google Maps, and OSM for a fact the site does not state, then «уточняйте». A map URL is in `sources`. No text, description, photo, review, rating, average check, or price comes from a map. Prices stay the official menu. `kgdmore.ru` is absent. No sentence is copied from another guide or from another K39 page.
- Duplicates. The summary is not repeated as the opening. Place `faq` is not also a body `## Частые вопросы`. A price row is not duplicated. With ticket rows stored (`admission_get`), `places.price` is empty (score check «Цена в тексте спорит с таблицей билетов») and the body does not repeat ticket amounts or event dates. A venue dish list is not the full menu. On a page above the default length ceiling, an H2 is not a near-copy of another H2, and a paragraph is not a near-copy of another paragraph.
- Length. The default ceiling in `k39-writing` still applies. A longer body needs a justified `lengthOverride` from `page_passport_get`: ceiling at most 20000, target queries, observed impressions and position or competitor lengths, and the extra sections. Each added section has its own sourced facts. Stop-list filler and padding to fill the extra room fail. An override with no search impressions after 60 days is a reason to cut the page back.
- Notices. Check the notices on the page (`notices_get`): dates, source, and the open-ended reason. Look for stale closure prose that a notice should replace.
- Photos. A missing photo is a note, not a blocker. A photo that is attached still needs `alt`, `author`, `license`, and `sourceUrl`.
- Score. `content_score_get` with `refresh: true`. `passport empty`, `facts not checked`, `stale facts` once the page cites fact rows, a venue description outside 300–600, and `no Как добраться` on a page that needs it block publish. `0 photos` is a note.

The score counts structured `faq` through `pageFaq`. A body `## Частые вопросы` counts only when `faq` is empty. Do not ask the author to paste a second FAQ into the body.

Write `PASS` or a list of failures. Do not publish on failures.

## Publish

Only after `PASS`:

- Place, route, collection, quest: `content_set_publication` with `published`.
- Venue: `venue_update` with `status: published` and `lastVerifiedAt`.
- Hub: `hub_update` with the reviewed body.

A later edit that omits publication status leaves a published page published. Do not unpublish by accident.

## Examples

Bad: the writing agent calls `content_set_publication` at the end of the same turn, with no second read.

Good: the author saves a draft, moves a place to `review`, and stops. A second pass loads `place_get`, finds «уютная атмосфера» in the intro, and returns that line. The author deletes it. The next reviewer pass writes `PASS`. Then publish.

Bad: clearing `no FAQ` by copying the six structured answers into the body.

Good: the review says `PASS`. Structured `faq` already counts. A second list in the body is a duplicate.

## Checklist

- Author checklist of the page-type skill is done on the stored row.
- Reviewer is a second pass and started from `queue_list`, then `*_get`.
- Stop-list, sources, duplicates, length, and photos were checked.
- Score failures are fixed, except the structured-FAQ gap, which is noted.
- The review says `PASS`.
- Publish happens only after that.
