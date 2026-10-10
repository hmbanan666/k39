# ADR 0007: Content in Postgres, admin in this app

## Status

Accepted. Supersedes ADR 0001.

## Context

Place copy used to live in `@nuxt/content` markdown, with a startup sync into a thin Postgres row. That split drifts, and an external CMS is a second system to operate. The owner wants one database, an admin inside this app, and no markdown files in the repo.

## Decision

Categories, regions, places, media metadata, routes, collections, quests, manual related links and slug redirects are Postgres tables. Place body is markdown text in a column, rendered by a small in-repo function. Files themselves sit on disk under `MEDIA_DIR`. Offers, offer codes and analytics events stay as they were.

`@nuxt/content` is removed. The 27 fort pages and the five-fort quest are inserted by `applyInitialContent()` after migrations. After that, Postgres is the editorial source of truth.

Humans edit through `/admin`, gated by Yandex or VK login and `users.role` (`editor` or `admin`). Emails in `ADMIN_EMAILS` are promoted to admin on login. An agent may create and update drafts through `/api/content/*` with `CONTENT_API_TOKEN`. That API cannot set `published`.

Each place update stores the previous row in `revisions` and sets `updated_by`.

## Consequences

The public site does not render if `DATABASE_URL` is missing. Media uploads disappear on redeploy unless Dokploy mounts a volume at `MEDIA_DIR`. The initial JSON snapshot under `packages/database/src/seed/` is a bootstrap, not a CMS.
