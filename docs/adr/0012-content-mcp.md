# ADR 0012: Content MCP

## Status

Accepted.

## Context

Editors and agents already create drafts through `POST` and `PATCH /api/content/places` with `CONTENT_API_TOKEN`. A separate MCP process would copy that logic. The site should expose the same role over the Model Context Protocol from this Nuxt app.

## Decision

`@nuxtjs/mcp-toolkit` 0.24.1 registers tools, one resource, and one prompt from `server/mcp/`. The streamable HTTP endpoint is `/mcp`.

Every request needs `Authorization: Bearer $CONTENT_API_TOKEN`, the same check as the content API (`contentAuthFailure` / `requireContentToken`). A missing or wrong token is HTTP 401. If the token is unset, the answer is 503. There is no OAuth discovery. An in-memory limit of 60 calls per minute applies per token.

On 2026-10-11 Nick decided this token has the same content rights as an editor. Tools may publish, unpublish (`publicationStatus: draft`), edit a published row, and set `noindex`. There is no separate archive status in the schema. The token cannot manage users, roles, or site settings.

Writes go through the same repository methods as `/admin`. A slug change inserts a `slug_redirects` row with status 301. Each update stores the previous place row in `revisions`. The sitemap, nearest-place links, and public pages read publication status from Postgres on request, so a publish has the same effect as saving `published` in the admin form. There is no extra cache purge.

Quest writes use `Editor.saveQuest`, added because the repository previously had no quest save. Hub updates use `Editor.saveCategory`. Media delete uses the same file removal as `/admin`.

`media_upload_from_url` accepts https URLs on public hosts only, then runs the Sharp pipeline. Commons search and import reuse the Wikimedia helper and its license filter.

Each successful write inserts an `mcp_audits` row with actor `mcp`, the tool name, and the entity. The content HTTP API uses the same actor.

The `content_guide` resource (`k39://content-guide`) and the matching prompt state the Russian writing rules: no invented facts, cite sources, and publish only with those sources and a licensed photo.

Sample client:

```json
{
  "mcpServers": {
    "k39": {
      "url": "https://k39.online/mcp",
      "headers": {
        "Authorization": "Bearer $CONTENT_API_TOKEN"
      }
    }
  }
}
```

## Consequences

`/mcp` is disallowed in `robots.txt` and reserved so it cannot be a place slug. The Nuxt app is on 4.6 so the toolkit's Vue, h3, and kit peers match.
