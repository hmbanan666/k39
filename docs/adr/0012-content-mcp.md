# ADR 0012: Content MCP

## Status

Accepted.

## Context

Editors and agents already create drafts through `POST` and `PATCH /api/content/places` with `CONTENT_API_TOKEN`. A separate MCP process would copy that logic. The site should expose the same role over the Model Context Protocol from this Nuxt app.

## Decision

`@nuxtjs/mcp-toolkit` 0.24.1 registers tools, one resource, and one prompt from `server/mcp/`. The streamable HTTP endpoint is `/mcp`.

Every request needs `Authorization: Bearer $CONTENT_API_TOKEN`, the same check as the content API (`contentAuthFailure` / `requireContentToken`). A missing or wrong token is HTTP 401. If the token is unset, the answer is 503. There is no OAuth discovery. An in-memory limit of 60 calls per minute applies per token.

On 2026-10-11 Nick decided this token has the same content rights as an editor. Tools may publish, unpublish (`publicationStatus: draft`), edit a published row, and set `noindex`. `content_set_publication` accepts only `draft`, `review`, and `published`. Requesting `archived` there is a 400. Omitting `publicationStatus` on an update keeps the current status, including `archived`. The token cannot manage users, roles, or site settings.

`route_draft_create`, `route_draft_update`, and `route_update` accept ordered `points: [{ placeSlug, note? }]`. `route_update` is an alias of `route_draft_update` and edits a published route in place. `collection_save` accepts ordered `items` in the same shape, and a save by slug loads the current row so an omitted status does not unpublish it. Each `placeSlug` must already exist. A missing slug fails before the parent row changes. Omitting the array leaves the current stops. An empty array clears them. Order is the array order, stored as `position` starting at 0. `note` is an optional text column (migration `0009_point_notes`). A blank note is stored as null. `route_get` and `collection_get` return every stop, including stops whose place is still a draft.

`content_archive` takes a route or collection by id or slug. A draft is hard-deleted. A published or review row is not deleted: `publication_status` becomes `archived`, the row leaves the sitemap, and `slug_redirects` records 410 for `/marshruty/{slug}` or `/podborki/{slug}`. Publishing that slug again removes the 410. A draft route that a quest or offer still links is left in place and the tool returns 409. The call writes an `mcp_audits` row with tool `content_archive`. ADR 0014 records that decision.

`page_passport_get` and `page_passport_set` read and write the page passport (ADR 0016). `content_scores_list`, `content_score_get`, and `content_report_weekly` read the stored score. `content_score_get` and `content_report_weekly` accept `refresh: true`, which recomputes every page and writes `content_scores` plus today's `content_score_days` row. Those writes insert an `mcp_audits` row. The token still cannot manage users or settings.

`quest_save` and `quest_update` accept `routeSlug`. A slug retargets the quest, including onto a draft route. `null` clears the link. Omitting `routeSlug` keeps the current route. `quest_get` and `quests_list` return `routeSlug`. After the quest no longer points at a draft route, `content_archive` can delete that draft. `quest_update` edits an existing quest and does not create one. Both writes insert an `mcp_audits` row.

`region_list` returns every region. `region_upsert` creates or updates one by slug. `name` is stored as `regions.title`. `coordinates` and `center` are the same optional `{ latitude, longitude }`. Null clears the center. Omitting both leaves the stored point. The write inserts an `mcp_audits` row with tool `region_upsert`. Migration `0010_coastal_districts` adds nullable `latitude` and `longitude` and inserts `zelenogradsk`, `svetlogorsk`, `baltiysk`, and `sovetsk` under their official district names: Зеленоградский муниципальный округ, Светлогорский городской округ, Балтийский городской округ, Советский городской округ. Centers stay null until an editor sets them.

`hub_update` writes title, description, markdown `body`, `seoTitle`, `seoDescription`, `ogImage`, and `noindex`. Omitting a field keeps the stored value. `body` is the hub article (migration `0012_hub_body`). The same `## Частые вопросы` parser used on places turns that section into FAQPage. A question is `**…?**` or a `###` heading. The call inserts an `mcp_audits` row with tool `hub_update`. `hubs_list` returns the body and the SEO fields. `/admin` edits the same columns.

Writes go through the same repository methods as `/admin`. A slug change inserts a `slug_redirects` row with status 301. Each update stores the previous place row in `revisions`. The sitemap, nearest-place links, and public pages read publication status from Postgres on request, so a publish has the same effect as saving `published` in the admin form. There is no extra cache purge.

Quest writes use `Editor.saveQuest`. Hub updates use `Editor.saveCategory`. Region writes use `Editor.upsertRegion`. Media delete uses the same file removal as `/admin`.

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
