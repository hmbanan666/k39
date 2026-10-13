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

On boot the Nitro plugin migrates, then `applyInitialContent()` inserts categories, the 27 fort pages, one route, one collection and the five-fort quest if `content_imports` does not already contain `initial-content-v1`. `initial-content-v2` then fills seeded slugs that are still empty drafts from the old catalog and publishes them. A later boot skips both. An empty `ADMIN_EMAILS` is fine: the site still serves public pages, and nobody is promoted to admin until that list is set. Later edits happen in `/admin` or through `POST`/`PATCH /api/content/places` and the MCP server with `Authorization: Bearer $CONTENT_API_TOKEN`. That token can publish and edit live content. It cannot manage users or settings.

## Content MCP

Streamable HTTP: `https://k39.online/mcp` (`@nuxtjs/mcp-toolkit`, ADR 0012). Same bearer token as the content API. Missing or wrong token: 401. Unset token: 503. Sixty calls per minute per token. The token can publish, unpublish, and edit live places, routes, collections, quests, hubs, regions, and media. Every write is an `mcp_audits` row with actor `mcp`.

Tools: `places_list`, `place_get`, `place_draft_create`, `place_update`, `place_draft_update` (alias of `place_update`), `place_submit_review`, `content_set_publication`, `content_archive`, `hubs_list`, `hub_update`, `region_list`, `region_upsert`, `routes_list`, `route_get`, `route_draft_create`, `route_draft_update`, `route_update` (alias of `route_draft_update`), `collections_list`, `collection_get`, `collection_save`, `quests_list`, `quest_get`, `quest_save`, `quest_update`, `page_passport_get`, `page_passport_set`, `content_scores_list`, `content_score_get`, `content_report_weekly`, `media_upload_from_url`, `media_attach_to_place`, `media_list_for_place`, `media_delete`, `commons_search`, `commons_import`, `content_guide`. The same guide is also a resource and a prompt. Omitting `publicationStatus` on an update leaves a published page published. `route_draft_create`, `route_draft_update`, and `route_update` accept ordered `points: [{placeSlug, note?}]`. `collection_save` accepts ordered `items` in the same shape. Each `placeSlug` must exist. Omitting the array leaves the current stops. `content_archive` hard-deletes a draft route or collection and archives a published or review row (the public URL returns 410). A draft route that a quest still links returns 409. `quest_save` and `quest_update` change that link with `routeSlug`, or `null` to clear it, so the draft can be deleted. `region_list` and `region_upsert` read and write regions (`slug`, `name`, optional `coordinates` or `center`). `regionSlug` is a slug from the regions table. Page passports and the 0-100 score are ADR 0016. Later offer work is `docs/roadmap.md`. The first Commons import on an empty place becomes the cover. A repeat import of the same Commons page on that place returns the existing photo. Venues (ADR 0018) use `venue_create`, `venue_update`, `venue_get`, `venues_list`, `venue_import_osm`, `venue_listing_intro_set`, and `venue_stats`. OSM import creates drafts and dedupes by `osmId`. It does not publish. `offers.venue_id` links an offer to a venue. `FEATURE_SPONSORED_VENUES` is off until a partner slot should lead «Где поесть рядом».

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

The forts map component remains `MapFortsMap` (`app/components/map/FortsMap.vue`). It is not linked and not in the sitemap. Set `FEATURE_MAP=true` to serve `/map/{region}` with `noindex`. Otherwise those URLs 301 to `/forty`. Place, venue, and route pages, and `/karta`, use the K39 map (ADR 0019): MapLibre with the OpenFreeMap Positron style, custom pins, clustering, and a pin card. «Как добраться» opens Yandex Maps with that point as the destination. Route pages still build the whole line in Yandex or Google. See ADR 0015.

Auth is `nuxt-auth-utils`: Yandex and VK use `defineOAuthYandexEventHandler` and `defineOAuthVKEventHandler`, and the admin session is `requireUserSession` / `setUserSession`. Empty client id or secret disables that provider. `ADMIN_EMAILS` promotes those accounts to `admin` on login. Editors and admins can open `/admin`. Anonymous visitors go to `/sign-in?redirectTo=/admin`. The session cookie is sealed with `NUXT_SESSION_PASSWORD` (32+ characters). `nuxt-auth-utils` does not read `NUXT_APP_SECRET`; switch to that when the library supports `appSecret` natively. See ADR 0005.

`POST /api/events` still requires `consent: true` and stores no IP address. It does not set a cookie. `useTrack()` sends nothing while `NUXT_PUBLIC_CONSENT_BANNER` is off.

Page analytics (ADR 0013) is cookieless for every visitor. `public/collect.js` beacons to `POST /api/collect`. The visitor key is a daily HMAC of salt, IP, and User-Agent, and the IP is not stored. `CookieNotice` is a client-only bar with one button, «Хорошо». Dismiss is `localStorage` key `k39_cookie_notice`, not a cookie. `NUXT_PUBLIC_CONSENT_BANNER` stays off until user cabinets exist. The only persistent cookie is the admin session. Raw hits last 13 months. `analytics_daily` is kept. Search queries are imported when `YANDEX_WEBMASTER_TOKEN` plus `YANDEX_WEBMASTER_HOST_ID`, or Google Search Console credentials, are set. Read-only MCP tools `analytics_overview`, `analytics_channels`, `analytics_top_pages`, `analytics_landing_pages`, `analytics_referrers`, `analytics_search_queries`, `analytics_events`, `analytics_realtime`, and `analytics_page` are audited. The same numbers are on `/admin/analytics`.

## Conventions

- User-facing UI copy and place/quest/legal content: Russian. Do not use em dashes in UI chrome or in the HTML title. The title pattern is `{title} | K39`, or `{seoTitle} | K39` when that field is set. Do not append a second type word.
- ADRs, this file, the README, code comments: English.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`). Husky runs lint-staged and commitlint.
- Never add invented Co-authored-by trailers; noreply emails map to real GitHub users.
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
- Required env: `DATABASE_URL`, `NUXT_SESSION_PASSWORD` (32+ characters), `NODE_ENV=production`
- Optional env: OAuth client id/secret pairs, `ADMIN_EMAILS`, `CONTENT_API_TOKEN`, `FEATURE_MAP`, `NUXT_PUBLIC_YANDEX_MAPS_API_KEY`, `NUXT_PUBLIC_YANDEX_VERIFICATION`, `NUXT_PUBLIC_GOOGLE_VERIFICATION`
- Volume: mount a writable directory at `MEDIA_DIR` (image default `/app/media`, process uid 1000). Without the volume, uploads vanish on redeploy.

There is no separate migration job. On boot the Nitro plugin (`server/plugins/01.database.ts`) runs Drizzle migrations from `MIGRATIONS_FOLDER` (the image sets `/app/migrations`) and then applies the one-time content import. The migrate is idempotent. Search console steps are documented in `docs/search-consoles.md` and are not configured from this repo. Empty `NUXT_PUBLIC_YANDEX_VERIFICATION` and `NUXT_PUBLIC_GOOGLE_VERIFICATION` add no meta tags.

`www.k39.online` returns 301 to `https://k39.online` plus the path and query. Other hosts are unchanged, so container health checks on localhost keep working.

`/api/health` runs `select 1` and is the image health check.

Do not add Kubernetes manifests or GitHub Actions deploy workflows.

## Pages

- `/{slug}`: place. Hub, nearest, same-region, routes, collections, manual related links. JSON-LD matches the category.
- Hubs: `/forty`, `/zamki`, `/plyazhi`, `/kurorty`, `/muzei`, `/eda`. A hub stores a markdown `body`, rendered with the place article renderer. A `## Частые вопросы` section adds FAQPage. `hub_update` writes the body and the SEO fields and is audit-logged. `/admin` edits the same fields.
- `/marshruty`, `/podborki`, `/kvesty` and their slugs.
- `/zavedeniya` and `/zavedeniya/{slug}`. Filter URLs such as `/zavedeniya/svetlogorsk/kofe` are indexable when a listing intro is set. Place and route pages list nearby food venues.
- `/admin`: editors and admins. `/preview/{slug}` shows a draft to those users and is `noindex`.
- `/sign-in`, `/about`, `/privacy`, `/terms`. `/cookies` redirects to `/privacy#cookies`. `/legal/privacy-policy` redirects to `/privacy`.

Sitemap source: `server/routes/sitemap-urls.get.ts` (published, indexable rows only). Robots: `public/robots.txt`, served as-is so the Yandex `Host` line stays.
