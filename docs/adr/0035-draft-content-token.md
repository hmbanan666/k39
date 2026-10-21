# ADR 0035: Draft content token

## Status

Accepted. Amended by [ADR 0041](0041-collection-route-drafts.md) for collections and routes. Venues, quests, listings, and archive stay refused.

## Context

Cloud agents could not use `https://k39.online/mcp`. Tool discovery failed before any content call. The only credential was `CONTENT_API_TOKEN`, which can publish and edit a live page. That secret is the wrong one to put in a cloud agent's MCP settings, and the handshake did not tell the client to use a configured bearer.

`POST /mcp` without a token returned a Nitro 401 JSON body and no `WWW-Authenticate` header. Cursor's MCP client treats any 401 as the start of OAuth discovery. This server does not speak OAuth (`/.well-known/oauth-protected-resource` is a 404). Without a bearer challenge, and without `resource_metadata` (which would force OAuth), discovery stopped in an error instead of retrying with the header from the Cloud Agents MCP settings. The host itself is reachable: an unauthenticated POST gets that 401 in under a second. Egress is not the failure.

`PATCH /api/content/places/[slug]` also dropped `faq`, `sections`, `bestTime`, `visitDuration`, and `regionSlug`, so a client that could not use MCP could not write the place fields the MCP schema already accepted. The score counted FAQ only from a `## Частые вопросы` section in the body.

## Decision

One writer. MCP tools and `POST`/`PATCH /api/content/places` call `createPlaceDraft` and `updatePlaceDraft`. The patch body is `placeWriteFromBody`, which forwards every place field the MCP schema accepts.

Two bearer secrets, compared in constant time:

- `CONTENT_API_TOKEN` is the editor token. It can publish, unpublish, and edit a live row. Same rights as ADR 0012.
- `CONTENT_DRAFT_TOKEN` is the agent token. It can read. It can create and update a draft or a review. It cannot set `published`. A write against a published or archived place is stored in `content_drafts` and the live row stays. `place_get` returns that row as `pendingReview`. An editor publish (`content_set_publication` with `published`, and no other fields) applies the pending payload and then deletes it. An editor write of the live row discards the pending payload.

The draft token cannot archive, edit a hub or a region, delete media, delete a venue, change the price catalog, migrate schedules, or edit a published venue, quest, or listing. Photo, schedule, and fact-value writes on a live page are the same 409 under ADR 0041. Those actions answer 403 or 409 and do not change the live page. A published route or collection is a pending draft under ADR 0041. Publishing stays the reviewer step in `k39-publish-review`.

`/mcp` answers a missing or wrong token with HTTP 401, `WWW-Authenticate: Bearer realm="k39"` (no `resource_metadata`), and a JSON-RPC error body. Unset tokens are still 503. The same 401 challenge is on the REST content routes. Sixty calls a minute are counted per presented secret.

The owner issues the draft token. This repo does not generate it and does not write it to the host:

1. `openssl rand -hex 32`
2. Set `CONTENT_DRAFT_TOKEN` on the web app and redeploy. Leave `CONTENT_API_TOKEN` as the editor secret.
3. In Cursor Cloud Agents, set the k39 MCP server to `https://k39.online/mcp` with header `Authorization: Bearer <that value>`.

If both variables hold the same string, it is the editor token.

Article text stays in Postgres. Do not commit drafts, seeds, or page files. `applyInitialContent` is the one-time bootstrap already recorded in `content_imports`.

## Consequences

A cloud agent with the draft token can list and write. It cannot publish. Until the owner sets the token on the host and in the Cloud Agents MCP settings, discovery still has no credential to send. The code change is what makes that credential work.

A pending draft is invisible on the public page. The score still reads the live `faq` column.

`place_update` with the draft token returns the stored draft: `pendingReview`, `bodyLength`, and `renderedFields`. `publicationStatus` in that response stays the live status. An editor publish applies the pending payload and deletes the draft in one transaction. An editor write through MCP that changes any other field discards the pending payload.

The `/admin` place form does not discard that draft on its own. It shows each field the pending payload would change, live value beside draft value. Apply calls `setPublication` with `published` and no other fields, the same writer as `content_set_publication`. Discard deletes the draft and leaves the live row. `PATCH /api/admin/places/[id]` returns 409 while a draft exists, and writes nothing, unless the body sets `pendingDraft` to `discard`. That choice writes the form and then deletes the draft. Venues are not stored in `content_drafts`: a draft token cannot edit a published venue, and the venue form has no pending row to apply.

ADR 0041 is the pending-draft path for a published route or collection. Venues, quests, listings, and archive stay on the refusal above.
