# ADR 0041: Pending drafts for collections and routes

## Status

Proposed.

## Context

ADR 0035 gives cloud agents `CONTENT_DRAFT_TOKEN`. That token can write a draft or a review. It cannot publish. A write against a published or archived place is stored in `content_drafts` and the live row stays. `place_get` returns that row as `pendingReview`. An editor `content_set_publication` with `published` and no other fields applies the payload and then deletes it. The `/admin` place form shows the same diff.

The same ADR refuses a draft-token edit of a published route, collection, quest, venue, or listing. The refusal is a 409 and the live page does not change. That is the right gate for venues, quests, listings, and archive: those writes are not an article an editor can apply as one payload.

Collections and routes are articles. An agent that can propose a place edit cannot propose a collection or route edit. The only way to change a live page is the editor token, which writes the live row immediately. `content_drafts` is already generic (`entity_type`, `entity_id`) and today only `place` is used.

## Decision

ADR 0035 is amended for collections and routes only.

A draft-token write to a published or archived collection or route is stored in `content_drafts` with `entity_type` `collection` or `route`. The live row, its ordered items or points, and the public page stay. Repeated writes merge into that one payload the same way a place draft does. The tool response is the stored draft: `pendingReview`, `pendingPublicationStatus`, `bodyLength`, `renderedFields`, and the ordered items or points. `publicationStatus` in that response stays the live status.

`collection_get` and `route_get` return `pendingReview` with the stored payload, for either token. The public page does not.

An editor `content_set_publication` with `published` and no other fields applies that payload through the content writer in `server/utils/content/save.ts`: the stop-list, review-hash pruning, and the section queue. The repository write, the slug 301, the ordered items or points, and the draft delete run in one transaction. A collection payload already holds the module projection, so apply writes that body and those modules. An editor write that changes any other field discards the pending payload and writes the live row.

The `/admin` collection and route forms show the pending draft the way the place form does: each changed field, live beside draft. Apply uses the same publication writer. Discard deletes the draft. A save is refused until the editor chooses to drop the draft.

Still refused, with no `content_drafts` row: publishing, archive, a published venue, a published quest, and a venue listing. Those answers stay 403 or 409 and do not change the live page.

## Consequences

An agent with the draft token can propose an edit to a live collection or route. It still cannot publish that edit. The public page changes only when an editor applies the draft.

Quests stay on the refusal. A quest is a link to a route plus steps, and this record does not give it a pending payload. A later record can add one if an agent needs to propose quest edits the same way.

The pending draft is invisible on the public page. The score still reads the live row.
