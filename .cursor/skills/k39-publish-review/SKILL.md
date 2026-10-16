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

A different agent, in a separate session. The author does not review their own draft, including in a later turn of the same session. The reviewer starts by loading the stored page.

Reject, with the failing lines, when any of these fail:

- Stop-list. Search `WRITING_STOP_LIST` and `WRITING_STOP_PATTERNS` in `apps/web-app/shared/writing.ts`, including inflected forms («идеальный», «идеальны», «самого»), «каждый найдет» without ё, triads, «не просто X, а Y», and an em dash. On a collection that renders modules, search the module text. `body` there is the projection of the modules, not a second article. `renderedFields` on the save says which fields show.
- Facts. Every number, date, hour, and price has an allowed source. For a venue that exists and operates, address, hours, phone, operating status, and coordinates follow `k39-sources-and-facts`: official site, then Yandex Maps, 2GIS, and OSM for a fact the site does not state, then «уточняйте». A map URL is in `sources`. No text, description, photo, review, rating, average check, or price comes from a map. Prices stay the official menu. `kgdmore.ru` is absent. No sentence is copied from another guide or from another K39 page.
- Duplicates. The summary is not repeated as the opening. Place `faq` is not also a body `## Частые вопросы`. A price row is not duplicated. A venue dish list is not the full menu.
- Photos. A missing photo is a note, not a blocker. A photo that is attached still needs `alt`, `author`, `license`, and `sourceUrl`.
- Score. `content_score_get` with `refresh: true`. `passport empty`, `facts not checked`, a venue description outside 300–600, and `no Как добраться` on a page that needs it block publish. `0 photos` is a note.

One known gap does not block: a place that uses the structured `faq` (3 to 6) and has no body FAQ can show `no FAQ`, because `faqFromBody` reads only `## Частые вопросы`. Note it. Do not ask the author to paste a second FAQ.

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

Good: the review says `PASS`, and notes `no FAQ` because `faq` is set and the body has no second list.

## Checklist

- Author checklist of the page-type skill is done on the stored row.
- Reviewer is a second pass and started from `*_get`.
- Stop-list, sources, duplicates, and photos were checked.
- Score failures are fixed, except the structured-FAQ gap, which is noted.
- The review says `PASS`.
- Publish happens only after that.
