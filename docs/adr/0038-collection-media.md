# ADR 0038: Photos on collections

## Status

Accepted

## Context

Month guides and themed collections need a cover and a small gallery with captions, authors and licenses.
Places already have a media pipeline: the `media` table, variants, credits, and the `place_media` link with cover and order.

## Decision

Collections reuse the same `media` rows through a new link table `collection_media` (collection, media, sort order, cover flag), the same shape as `place_media`.
`ingestImage` accepts `collectionId`, so `commons_import` and `media_upload_from_url` can attach to a collection.
New MCP tools: `media_attach_to_collection` (cover, order, caption, focal point), `media_list_for_collection`, `media_detach_from_collection`.
The collection page shows the cover above the text and the rest as a gallery. Each photo shows its caption, author, license and source, and opens in the shared photo viewer.
The cover is the Open Graph image when `ogImage` is empty, and all photos go into the page JSON-LD like on places.

## Consequences

One media model for places and collections. A photo can be linked to both without copying files.
