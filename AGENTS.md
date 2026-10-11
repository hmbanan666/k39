# AGENTS.md

## Product

K39 (https://k39.online) is a Russian-language SEO site for tourists in Kaliningrad Oblast. One page per place (forts, castles, beaches, resort towns, food). Illustrated SVG maps in a museum-booklet style, not tile maps. Routes and quests (visit points, progress in the browser). Later, local businesses create offers (a discount or a booking) attached to a place or a route and pay per result: a redeemed one-time code or a confirmed booking. Auction bids come after that. Every consented user action is stored as an event for aggregated, anonymized location analytics. Consent is required under 152-FZ.

Out of scope for this base: an internal messenger, booking through Dostigus agents, payment capture, and tile maps.

The UI and place articles are Russian. Docs, ADRs, and code comments are English.

## Architecture

Monorepo (pnpm):

- `apps/web-app`: Nuxt 4, Reka UI (headless only), `@nuxtjs/seo`, `nuxt-auth-utils`. Styling is local CSS tokens, not Tailwind and not `@nuxt/ui`. See ADR 0010 and `docs/design-system.md`. Place photos are processed with `sharp` (ADR 0011): master plus AVIF/WebP variants under `MEDIA_DIR/{id}/`. `<MediaImage>` is the public `<picture>`. Category SVG art is the fallback when a place has no cover.
- `packages/database`: Drizzle ORM and Postgres. Schema, repositories, SQL migrations, initial seed.
- `packages/types`: Zod schemas shared by the API.

Brand files live in `apps/web-app/public/`: `favicon.ico` (16, 32 and 48), `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `logo/moose-head` (png and webp, 1x and 2x), `logo/moose-head-512.webp`, `og-default.png`, `og-default.jpg`, and `site.webmanifest`. The source master is kept outside this repo. Do not regenerate or re-encode these binaries.

Published pages are server-rendered from Postgres. Place body is markdown text in the database. See ADR 0007, ADR 0008 and ADR 0009.

URLs: `/{slug}` for a place, `/forty` `/zamki` `/plyazhi` `/kurorty` `/muzei` `/eda` for hubs, `/marshruty/{slug}`, `/podborki/{slug}`, `/kvesty/{slug}`. Regions are not in the path. Old `/place/*`, `/quest/*` and (while the map flag is off) `/map/*` 301 in one hop. Details and the crawl rules are in ADR 0008. Search console setup is in `docs/search-consoles.md`.

On boot the Nitro plugin migrates, then `applyInitialContent()` inserts categories, the 27 fort pages, one route, one collection and the five-fort quest if `content_imports` does not already contain `initial-content-v1`. `initial-content-v2` then fills seeded slugs that are still empty drafts from the old catalog and publishes them. A later boot skips both. An empty `ADMIN_EMAILS` is fine: the site still serves public pages, and nobody is promoted to admin until that list is set. Later edits happen in `/admin` or, for drafts only, `POST`/`PATCH /api/content/places` with `Authorization: Bearer $CONTENT_API_TOKEN`.

## Content MCP

Streamable HTTP: `https://k39.online/mcp` (`@nuxtjs/mcp-toolkit`, ADR 0012). Same bearer token as the content API. Missing or wrong token: 401. Unset token: 503. Sixty calls per minute per token. Writes cannot publish. Quest drafts are not writable.

Tools: `places_list`, `place_get`, `place_draft_create`, `place_draft_update`, `place_submit_review`, `hubs_list`, `routes_list`, `route_get`, `route_draft_create`, `route_draft_update`, `quests_list`, `quest_get`, `media_upload_from_url`, `media_attach_to_place`, `media_list_for_place`, `commons_search`, `commons_import`. Resource and prompt: `content_guide`.

`@nuxtjs/mcp-toolkit` treats every file directly under `server/mcp/` as a handler (plus `tools/`, `resources/`, and `prompts/`). Only `index.ts` and those three folders belong there. Shared helpers live in `server/utils/mcp/` so the production build does not look for a default export on them.

```json
{
  "mcpServers": {
    "k39": {
      "url": "https://k39.online/mcp",
      "headers": { "Authorization": "Bearer $CONTENT_API_TOKEN" }
    }
  }
}
```

The forts map component remains `MapFortsMap` (`app/components/map/FortsMap.vue`). It is not linked and not in the sitemap. Set `FEATURE_MAP=true` to serve `/map/{region}` with `noindex`. Otherwise those URLs 301 to `/forty`.

Auth is `nuxt-auth-utils`: Yandex and VK use `defineOAuthYandexEventHandler` and `defineOAuthVKEventHandler`, and the admin session is `requireUserSession` / `setUserSession`. Empty client id or secret disables that provider. `ADMIN_EMAILS` promotes those accounts to `admin` on login. Editors and admins can open `/admin`. Anonymous visitors go to `/sign-in?redirectTo=/admin`. The session cookie is sealed with `NUXT_SESSION_PASSWORD`. If that is unset, boot derives the same password from `NUXT_APP_SECRET` (`deriveSecret`, purpose `nuxt-auth-utils:session`). A set password wins, so existing cookies stay valid. See ADR 0005.

`POST /api/events` records an event. `useTrack()` sends one only after the visitor accepts the consent banner. The banner is `position: fixed` so it does not shift the page. Rows require `consent = true`. The table has no IP address and no account id.

## Conventions

- User-facing UI copy and place/quest/legal content: Russian. Do not use em dashes in UI chrome. The HTML title template in ADR 0008 uses an em dash because that is the search snippet shape.
- ADRs, this file, the README, code comments: English.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`). Husky runs lint-staged and commitlint.
- Architecture decisions: `docs/adr/NNNN-title.md`.
- Vue files: template, then script, then style. ESLint is `@antfu/eslint-config` with the local overrides in `eslint.config.mjs`.

## Run

```bash
pnpm install
cp apps/web-app/.env.example apps/web-app/.env
pnpm --filter @k39/web-app dev
pnpm media:rebuild
```

`pnpm media:rebuild` regenerates photo variants from masters already on disk. It needs `DATABASE_URL` and `MEDIA_DIR`.

Dev server: http://localhost:3000. Public pages need `DATABASE_URL`. The plugin migrates and seeds before serving traffic.

Generate a new migration after a schema change:

```bash
pnpm --filter @k39/database db:generate
```

## Test and build

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm --filter @k39/web-app build
```

`pnpm test` runs the database suite and web-app checks for titles, canonicals, JSON-LD, redirects, robots.txt and orphan links. Point `DATABASE_URL` at a local database to skip Docker. The suite drops the `public` and `drizzle` schemas of that database when the host is localhost. Do not point it at a shared database.

## Deploy

Target: Dokploy.

- Dockerfile: `docker/web-app/Dockerfile`
- Build context: repository root
- The image enables pnpm with Corepack at the version in `packageManager` (`pnpm@10.25.0`). Do not `npm install -g pnpm`: that installs a newer pnpm, which then re-execs the pin. Build with `pnpm --filter @k39/web-app build`. `pnpm build --filter ...` appends `--filter` to the root script and then to `nuxt build`.
- The container runs as the image's `node` user (uid 1000). `node:24-alpine` already owns that uid, so the Dockerfile does not create another user. Mount a volume at `MEDIA_DIR` (`/app/media`) or uploads disappear on redeploy.
- CI job `docker` in `.github/workflows/ci.yml` runs that image build on pull requests.
- Port: 3000
- Auto-deploy: push to `main`
- Required env: `DATABASE_URL`, `NODE_ENV=production`, and one of `NUXT_SESSION_PASSWORD` or `NUXT_APP_SECRET` (32+ characters). Keep `NUXT_SESSION_PASSWORD` if it is already set.
- Optional env: OAuth client id/secret pairs, `ADMIN_EMAILS`, `CONTENT_API_TOKEN`, `FEATURE_MAP`, `NUXT_PUBLIC_YANDEX_VERIFICATION`, `NUXT_PUBLIC_GOOGLE_VERIFICATION`
- Volume: mount a writable directory at `MEDIA_DIR` (image default `/app/media`, process uid 1000). Without the volume, uploads vanish on redeploy.

There is no separate migration job. On boot the Nitro plugin (`server/plugins/01.database.ts`) runs Drizzle migrations from `MIGRATIONS_FOLDER` (the image sets `/app/migrations`) and then applies the one-time content import. The migrate is idempotent. Search console steps are documented in `docs/search-consoles.md` and are not configured from this repo. Empty `NUXT_PUBLIC_YANDEX_VERIFICATION` and `NUXT_PUBLIC_GOOGLE_VERIFICATION` add no meta tags.

`www.k39.online` returns 301 to `https://k39.online` plus the path and query. Other hosts are unchanged, so container health checks on localhost keep working.

`/api/health` runs `select 1` and is the image health check.

Do not add Kubernetes manifests or GitHub Actions deploy workflows.

## Pages

- `/{slug}`: place. Hub, nearest, same-region, routes, collections, manual related links. JSON-LD matches the category.
- Hubs: `/forty`, `/zamki`, `/plyazhi`, `/kurorty`, `/muzei`, `/eda`.
- `/marshruty`, `/podborki`, `/kvesty` and their slugs.
- `/admin`: editors and admins. `/preview/{slug}` shows a draft to those users and is `noindex`.
- `/sign-in`, `/legal/privacy-policy`.

Sitemap source: `server/routes/sitemap-urls.get.ts` (published, indexable rows only). Robots: `public/robots.txt`, served as-is so the Yandex `Host` line stays.
