# ADR 0014: Ordered stops and archive

## Status

Accepted.

## Context

`route_points` and `collection_items` already store an ordered place for routes such as `pyat-fortov`. The MCP tools could edit the route or collection text, but they could not set those rows. Editors also had no way to remove a draft route or collection. ADR 0012 kept publication status to `draft`, `review`, and `published`.

## Decision

`route_draft_create`, `route_draft_update`, and `route_update` accept `points: [{ placeSlug, note? }]`. `collection_save` accepts `items` in the same shape. `route_update` is an alias of `route_draft_update`, the same pattern as `place_update`. Omitting the array leaves the current rows. An empty array clears them. Order is the array order, stored as `position` starting at 0. Each `placeSlug` must already exist; a missing slug fails the write before the parent row changes. `note` is an optional text column on `route_points` and `collection_items` (migration `0009_point_notes`). A blank note is stored as null. Public pages show the note beside the stop and put it on the ItemList entry. Public lists still hide a stop whose place is not published. `route_get` and `collection_get` return every stop, including drafts.

`content_archive` deletes a draft route or collection and writes an `mcp_audits` row. A published or review row is not deleted. Its `publication_status` becomes `archived`, it drops out of the public site and the sitemap, and `slug_redirects` records 410 for `/marshruty/{slug}` or `/podborki/{slug}`. Publishing that slug again removes the 410. A draft route that a quest or offer still links is left in place and the tool returns 409. `quest_save` and `quest_update` clear that block: set `routeSlug` to another route, or `null`, and the draft can be deleted. `content_set_publication` still accepts only `draft`, `review`, and `published`. An edit that omits `publicationStatus` keeps `archived`.

Place, route, collection, hub, and quest JSON-LD reuse `faqPageNode`, which calls `faqFromBody`. A body with `## Частые вопросы` adds FAQPage. Hub copy is `categories.body`.

## Consequences

Archived rows stay in `/admin` and in the MCP lists. The admin status select includes «в архиве» so a save does not drop the status. Hard-deleting a draft does not write a 410, because that URL was not public.
