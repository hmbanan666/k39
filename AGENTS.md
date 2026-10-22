# AGENTS.md

## Product

K39 (https://k39.online) is a Russian-language SEO site for tourists in Kaliningrad Oblast. One page per place (forts, castles, beaches, resort towns, food). The visitor map is `/map` (`@k39/map`, MapLibre). Routes and quests show ordered visit points; saved progress and quest completion are not implemented. Later, local businesses create offers (a discount or a booking) attached to a place or a route and pay per result: a redeemed one-time code or a confirmed booking. Auction bids come after that. The consent-gated `useTrack()` sends nothing while `NUXT_PUBLIC_CONSENT_BANNER` is off (the repository default). Cookieless page and interaction analytics and search events have separate paths under ADR 0013 and ADR 0030.

Out of scope for this base: an internal messenger, booking through Dostigus agents, and payment capture.

The UI and place articles are Russian. Docs, ADRs, and code comments are English.

The dated implementation inventory is `docs/product-state.md`; the proposed stabilization order is `docs/roadmap.md`. Product readiness and a faster, reproducible agent workflow are priorities. Accepted ADRs record decisions, not proof of implementation. Recheck code and deployment before relying on a claim.

## Architecture

Monorepo (pnpm):

- `apps/web-app`: Nuxt 4, Reka UI (headless only), `@nuxtjs/seo`, `nuxt-auth-utils`. Styling is local CSS tokens, not Tailwind and not `@nuxt/ui`. See ADR 0010 and `docs/design-system.md`. Place photos are processed with `sharp` (ADR 0011): master plus AVIF/WebP variants under `MEDIA_DIR/{id}/`. `<MediaImage>` is the public `<picture>`. Category SVG art is the fallback when a place has no cover. Moose mascot stickers: `docs/stickers.md` (`<Sticker>`). Food stickers for price-anchor cards: `docs/food-stickers.md` (`<Sticker set="food">`, `public/stickers/food/`, `shared/food-stickers.ts`).
- `packages/database`: Drizzle ORM and Postgres. Schema, repositories, SQL migrations, initial seed.
- `packages/types`: Zod schemas shared by the API.
- `packages/map`: `@k39/map`, the MapLibre map core (ADR 0019, ADR 0037).

Brand files live in `apps/web-app/public/`. Tab icon: `favicon.ico` (PNG frames at 16, 32 and 48), `favicon-16.png`, and `favicon-32.png`. Touch icon: `apple-touch-icon.png` (180, on `#F5EEE1`). Install icons: `icon-192.png`, `icon-512.png`, and `icon-maskable-512.png` (safe zone on `#F5EEE1`). Header moose: `logo/moose-head` (png and webp, 1x and 2x). Organization logo: `logo/moose-head-512.webp`. Default social card: `og-default.png` and `og-default.jpg`. Install manifest: `site.webmanifest`. The source master is kept outside this repo. Icon files change only through `node scripts/brand/render-icons.mjs <master>` (ADR 0010). The script sets `BRAND_ICON_VERSION` in `apps/web-app/shared/seo.ts` and writes that same `?v=` onto the manifest icons. Do not re-encode the committed binaries by hand. The header moose and the social card are not produced by that script. Favicon, touch icon, and manifest URLs append `?v=` from that constant. The file names stay. There is no SVG favicon.

Published pages are server-rendered from Postgres. Place body is markdown text in the database. See ADR 0007 and ADR 0008.

URLs: `/{slug}` for a place, `/forty` `/zamki` `/plyazhi` `/kurorty` `/muzei` `/eda` for hubs, `/marshruty/{slug}`, `/podborki/{slug}`, `/kvesty/{slug}`. Regions are not in the path. Old `/place/*` and `/quest/*` 301 in one hop. `/map` is the visitor map. `/map/forty` and `/karta` are not redirected. Details and the crawl rules are in ADR 0008. Search console setup is in `docs/search-consoles.md`.

On boot the Nitro plugin migrates, then `applyInitialContent()` inserts categories, the 27 fort pages, one route, one collection and the five-fort quest if `content_imports` does not already contain `initial-content-v1`. `initial-content-v2` then fills seeded slugs that are still empty drafts from the old catalog and publishes them. A later boot skips both. An empty `ADMIN_EMAILS` is fine: the site still serves public pages, and nobody is promoted to admin until that list is set. Later edits happen in `/admin` or through `POST`/`PATCH /api/content/places` and the MCP server. Those two entry points call the same place writer. Place, venue, route, collection, quest, hub, and passport saves go through `apps/web-app/server/utils/content/save.ts`: it normalizes the prose, runs the stop-list, writes the row, drops review hashes that no longer match, and enqueues changed sections. `CONTENT_API_TOKEN` is the editor bearer: it can publish and edit live content. `CONTENT_DRAFT_TOKEN` is the agent bearer: writes land as drafts or a pending review, and it cannot publish. Neither token can manage users or settings. Article text is not committed to this repo as drafts, seeds, or page files. `applyInitialContent` is the one-time bootstrap already recorded in `content_imports`. Do not add another.

`pnpm db:seed:fixtures` upserts test fixtures after migration. It is not boot content and not an article. Slugs: towns `fixture-town` (hub photo via place `fixture-town`) and `fixture-plain` (no photo); venues `fixture-cafe-photo` (photo, coordinates, three prices, schedule, Instagram, every venue module), `fixture-cafe-plain` (no photo, coordinates, prices, schedule), `fixture-cafe-peer` (third price for a band), `fixture-cafe-nocoords`, `fixture-cafe-open` (verified schedule with an opening time and no closing time, ADR 0042), `fixture-cafe-weekdays` (verified weekday hours, weekend hours unknown, ADR 0044), `fixture-cafe-seasons` (two seasons, a monthly closure, and an exception, so the venue forms show the hours read-only); places `fixture-stop`, `fixture-contact` (phone, website, schema subtype `Church`; public in the `muzei` hub once boot content exists), `fixture-museum` (ticket table, two upcoming events, one past and one cancelled event that never render, ADR 0046), and `fixture-tickets-stale` (only stale ticket rows); route `fixture-route` (both places as stops, its own ticket row); collection `fixture-modules` (every page module, `fixture-museum` among the items). Dated notices (ADR 0049), relative to the seed day: `fixture-cafe-photo` has a current relocation and an expired row, `fixture-cafe-plain` an upcoming `closed`, and `fixture-contact` a current `closed` and an upcoming renovation. The 32 price-catalog slugs are `PRICE_CATALOG` in `packages/database/src/seed/price-catalog.ts`. A second run updates those rows. Pages are `noindex`.

## Content MCP

Streamable HTTP: `https://k39.online/mcp` (`@nuxtjs/mcp-toolkit`, ADR 0012, ADR 0035). Same bearers as the content API. Missing or wrong token: 401 with `WWW-Authenticate: Bearer realm="k39"` and no OAuth metadata, so a cloud agent retries with the header configured on the MCP server. Both tokens unset: 503. Sixty calls per minute per secret. The editor token can publish, unpublish, and edit live places, routes, collections, quests, hubs, regions, and media. The draft token cannot publish, archive, or edit a published quest or listing. On a published or closed venue, venue_update, schedule_set for opening hours, and venue_prices_set stage allowed keys in content_drafts (ADR 0047). The editor applies them with content_set_publication; newer owner changes keep their keys pending. An archived venue refuses these writes. A draft-token write to a published place, route, or collection is stored in `content_drafts` and the public page stays. A draft-token photo write on a published or archived place or collection, or on a published, closed, or archived venue, is a 409. A schedule write on a published or archived place is also 409; a published or closed venue stages its opening schedule (ADR 0047). A draft-token `fact_update` is the same 409 when the fact's parent is live: a published or archived place or route, a stop on that route, a region, a published or closed venue, or a subject type the writer does not resolve. `venue_delete` is editor-only. `place_get`, `route_get`, `collection_get`, and `venue_get` return `pendingReview`. The update returns that stored draft: `pendingReview`, `bodyLength`, and `renderedFields`, plus ordered points or items for a route or a collection. An editor `content_set_publication` with `published` and no other fields applies the pending payload and then deletes the draft. `PATCH /api/content/places` uses the same writer. Every write is an `mcp_audits` row with actor `mcp`.

The owner issues `CONTENT_DRAFT_TOKEN` (`openssl rand -hex 32`), sets it on the web app, redeploys, and adds `https://k39.online/mcp` in Cursor Cloud Agents with `Authorization: Bearer <that value>`. Do not commit the value. Do not write it from an agent.

Tools: `places_list`, `place_get`, `place_draft_create`, `place_update`, `place_draft_update` (alias of `place_update`), `place_submit_review`, `content_set_publication`, `content_archive`, `hubs_list`, `hub_update`, `region_list`, `region_upsert`, `routes_list`, `route_get`, `route_draft_create`, `route_draft_update`, `route_update` (alias of `route_draft_update`), `collections_list`, `collection_get`, `collection_save`, `quests_list`, `quest_get`, `quest_save`, `quest_update`, `page_passport_get`, `page_passport_set`, `content_scores_list`, `content_score_get`, `content_score_preview`, `content_report_weekly`, `queue_list`, `fact_get`, `fact_confirm`, `fact_update`, `page_mark_reviewed`, `notices_get`, `notices_set`, `notices_list`, `personas_list`, `page_personas_get`, `page_personas_set`, `media_upload_from_url`, `media_attach_to_place`, `media_list_for_place`, `media_delete`, `commons_search`, `commons_import`, `content_guide`. The same guide is also a resource and a prompt. Omitting `publicationStatus` on an update leaves a published page published. `route_draft_create`, `route_draft_update`, and `route_update` accept ordered `points: [{placeSlug, note?}]` and an optional `path` of `[longitude, latitude]` pairs. Omit `path` to keep it. Null clears it. The map uses that line only for the selected route. `collection_save` accepts ordered `items` in the same shape. Each `placeSlug` must exist. Omitting the array leaves the current stops. `content_archive` hard-deletes a draft route or collection and archives a published or review row (the public URL returns 410). A draft route that a quest still links returns 409. `quest_save` and `quest_update` change that link with `routeSlug`, or `null` to clear it, so the draft can be deleted. `region_list` and `region_upsert` read and write regions (`slug`, `name`, optional `coordinates` or `center`). `regionSlug` is a slug from the regions table. Page passports and the 0-100 score are ADR 0016. `content_score_get` reads the stored score. `content_score_preview` scores a draft, a review page, or a pending place payload and does not write `content_scores`. ADR 0034 lets a justified passport raise a page ceiling to 20000 characters. Personas (ADR 0024): eleven codes in `shared/personas.ts`, page targets in `page_personas` with one primary per page; `/admin/content-scores` shows them and filters pages without a primary. Static coverage per persona (ADR 0025) is the page × persona table under the scores; text modules can declare a `role` for it. Later offer work is `docs/roadmap.md`. The first Commons import on an empty place becomes the cover. A repeat import of the same Commons page on that place returns the existing photo. Venues (ADR 0018) use `venue_create`, `venue_update`, `venue_get`, `venues_list`, `venue_find_duplicates`, `venue_import_osm`, `venue_listing_intro_set`, `venue_listing_modules_set`, `venue_stats`, and `venue_delete`. `venue_delete` hard-deletes a draft or an archived venue and is editor-only. A published or closed venue stays. OSM import creates drafts and dedupes by `osmId`. It does not publish. A generated slug that clashes gains the town or district, then a number. Collection and venue photos use `media_attach_to_collection`, `media_detach_from_collection`, `media_list_for_collection` and `media_attach_to_venue` (ADR 0038 for collections). The shared price catalog is `price_items_list` and `price_item_upsert`, and `venue_price_bands_recompute` rebuilds the price bands of a town. Schedules (ADR 0028) use `schedule_get`, `schedule_set`, `schedules_list` and the one-off `schedules_migrate`. Ticket prices and dated events (ADR 0046) use `admission_get`, `admission_set`, `admissions_list`, `event_get`, `event_upsert`, and `events_list`. They write `admission_prices` and `calendar_events`, sync facts `admission` and `event`, and refuse a draft-token write on a live subject with 409. The nightly `event-expire` job retires past events. `offers.venue_id` links an offer to a venue. `FEATURE_SPONSORED_VENUES` is off until a partner slot should lead «Где поесть рядом».

`@nuxtjs/mcp-toolkit` treats every file directly under `server/mcp/` as a handler (plus `tools/`, `resources/`, and `prompts/`). Only `index.ts` and those three folders belong there. Tools use `defineStrictMcpTool` from `server/utils/mcp/tool.ts`; it rejects unknown arguments for every tool. The protocol test registers all actual definitions through the toolkit and MCP SDK. Shared helpers live in `server/utils/mcp/` so the production build does not look for a default export on them.

```json
{
  "mcpServers": {
    "k39": {
      "url": "https://k39.online/mcp",
      "headers": { "Authorization": "Bearer $CONTENT_DRAFT_TOKEN" }
    }
  }
}
```

Phase 1 of ADR 0033 writes `facts` beside the columns that already exist. Public venue pages, venue cards, and their JSON-LD read phone, address, coordinates, and operating status from `facts` through `fact_refs`, and fall back to the column only when that fact is missing. A gap renders «уточняйте». Place pages do the same for phone, coordinates, and status. A place phone (`places.phone`) is official-only and its fact carries the source URL. Hours on venue pages, cards, and JSON-LD come from `schedules` and `schedule_intervals`, not from `venues.hours` or a copy in the description. Prose that repeats those hours or a phone is a `fact_repeated` review warning and does not block publish. Verification starts at `queue_list`. A fact whose latest revision actor is `owner` is not overwritten by the content token. That conflict waits in `/admin`. The nightly source watcher claims `analytics_runs` kind `source-watch` and fetches official URLs only. Map sources are `map_yandex`, `map_2gis`, `map_google`, and `osm`, venues only. The public reader is `readShownFacts` in `apps/web-app/server/utils/facts/read.ts`.

Dated notices (ADR 0049) are the `notices` table: a relocation, a closure, a renovation, or another dated statement on a place or a venue, never a route or a collection. `notices_set` and the `/admin` place and venue forms share `setNotices` in `apps/web-app/server/utils/notices/write.ts`. The page compares `from` and `to` with today in Europe/Kaliningrad: an upcoming row shows with its dates, a row hides the day after `to`, and `expired_at` is only the hourly `notice-expire` flag for `notices_list` with `expired: true`. The hero aside «На эти даты» and the top of «Коротко» render through `TemporaryNotices`. A current `closed` row makes `OpeningLive`, venue cards, and `GET /api/public/availability` say closed without writing the schedule. A relocation address is text only: the stored address, the address fact, the pin, and JSON-LD stay. A notice is not a fact and does not change the score. The draft token on a live place or venue stages the list on `content_drafts` under `notices`; the editor `content_set_publication` with `published` (entity `venue` for a venue) applies it and keeps the publication status.

`@k39/map` is the map core (ADR 0019, visitor map page ADR 0037): basemap choice, the `paper` style, and layers for points, lines, numbered stops, and sponsored pins. The visitor map is `/map`: MapLibre GL draws one scene from that API. The server resolves the basemap at runtime. When the file at `NUXT_BASEMAP_FILE` exists and its sha256 matches `BASEMAP_SHA256`, the client receives `/basemap/kaliningrad.pmtiles` (Range). Otherwise the map uses OpenFreeMap, including when the file is missing. A background task on boot downloads `BASEMAP_SOURCE_URL` when the file is missing or the hash does not match. Those defaults are baked into the image. An https `NUXT_PUBLIC_PMTILES_URL` is an optional object-storage override. Glyphs and the sprite are on this origin. Rebuild steps are in `docs/basemap.md`. It is in the header and the footer. ADR 0037 also requires it in the sitemap, but the current generator omits it; see `docs/product-state.md`. Embedded venue and route maps use the same library, loaded lazily. A route draws a solid line only from `routes.path`. Otherwise the selected route shows numbered stops and a dashed connector. Direction links on the route page stay in ADR 0015. `NUXT_PUBLIC_YANDEX_MAPS_API_KEY` does not choose a basemap.

Auth is `nuxt-auth-utils`: Yandex and VK use `defineOAuthYandexEventHandler` and `defineOAuthVKEventHandler`, and the admin session is `requireUserSession` / `setUserSession`. Empty client id or secret disables that provider. `ADMIN_EMAILS` promotes those accounts to `admin` on login. Editors and admins can open `/admin`. Anonymous visitors go to `/sign-in?redirectTo=/admin`. The session cookie is sealed with `NUXT_SESSION_PASSWORD` (32+ characters). `nuxt-auth-utils` does not read `NUXT_APP_SECRET`; switch to that when the library supports `appSecret` natively. See ADR 0005.

`/kabinet` is the cabinet behind «Войти» (ADR 0031). The same account can claim a published or closed venue. A code goes to `contact_email` or `phone` only when `CLAIM_EMAIL_URL` or `CLAIM_SMS_URL` is set; otherwise the person leaves evidence and an editor decides in `/admin/claims`. After that, the owner edits `venues.modules` with `venueModulesSchema` and `venue_prices` with the same check as `venue_prices_set` (`sourceKind` forced to `owner`). The venue schedule is the only source of venue hours, and nothing reads `venues.hours`. The cabinet and `/admin/venues/{id}` load the weekly table from it and send it only when it changed; the writer replaces the week of its one season and keeps closures, exceptions, holidays, and the source. Seasons, breaks, or another mode show read-only and change through `schedule_set`. Status, slug, and SEO stay editorial. Every save keeps a revision; `/admin/venues/{id}` can restore one. `businesses.venue_id` is the later subscription hook. The cabinet is `noindex`.

Guest submissions (ADR 0036) are a review, a tip, a photo, or a correction on a published place or venue. The public byline is the first name and the initial of the surname. Nothing is public while `pending`. `/admin/guests` accepts, rejects with a note, or flags a dispute. The editor token does the same daily pass through `guests_pending_list`, `guest_approve`, `guest_reject`, and `guest_dispute_flag` (ADR 0040). Those tools call `moderateGuest`, the same writer as the admin route. The draft token cannot. Guests cannot submit through MCP. A photo marked `recognizableFace` is rejected on that writer. A correction, including a price, only enqueues `guest_report` on `verification_queue`. It does not write facts or `venue_prices`. The separate consent is `ugc-2026-10-16` at `/gostevye-materialy`, method `ugc-submit`. Sign-in consent stays `2026-10-12`. Guest text is not in the article, the search view, or JSON-LD except a `Review` for each review that is in the HTML. Photos use `media.license = guest` and are not the cover.

`POST /api/events` requires `consent: true`, stores no IP address, and does not set a cookie. `events.session_id` is a new random id on every row, so it does not group a visit (ADR 0043; it partly supersedes ADR 0004). `useTrack()` sends nothing while `NUXT_PUBLIC_CONSENT_BANNER` is off, and no control sets the `k39_consent` cookie.

Page analytics (ADR 0013) is cookieless for every visitor. `public/collect.js` beacons to `POST /api/collect`. The visitor key is a daily HMAC of salt, IP, and User-Agent, and the IP is not stored. `CookieNotice` is a client-only card with one button, «Хорошо». Dismiss is `localStorage` key `k39_cookie_notice`, not a cookie. `NUXT_PUBLIC_CONSENT_BANNER` defaults off; a user cabinet already exists. With that default, analytics does not set a visitor cookie. The sealed authentication session serves users, editors, and admins. Production configuration must be checked separately. Raw hits last 13 months. `analytics_daily` is kept. Search queries are imported when `YANDEX_WEBMASTER_TOKEN` plus `YANDEX_WEBMASTER_HOST_ID`, or Google Search Console credentials, are set. Yandex popular queries lag about three days, so the job requests a week ending three days ago. A range through yesterday is empty even when the token is set. Read-only MCP tools `analytics_overview`, `analytics_channels`, `analytics_top_pages`, `analytics_landing_pages`, `analytics_referrers`, `analytics_search_queries`, `analytics_events`, `analytics_realtime`, and `analytics_page` are audited. The same numbers are on `/admin/analytics`.

Site search (ADR 0030) is Postgres full-text (`russian`) plus `pg_trgm` over the `search_documents` view (published, indexable places, routes, collections, quests, venues, hubs, and cities with venues). Query text helpers live in `packages/database/src/search-text.ts`: normalization, wrong keyboard layout, transliteration, prefix terms. `GET /api/search?q=` is a pure read. The header form and the 404 form are plain `GET` forms to `/poisk` (server-rendered, `noindex, follow`, canonical `/poisk`). The page sends `search` and `click` events to `POST /api/search/events`; rows land in `search_events` with the ADR 0013 daily visitor key and session, no cookie and no IP, and are purged after 13 months. Refinements are linked server-side; exits without a click are derived in reports. Read-only, audited MCP tools `search_report` and `search_zero_results` and the page `/admin/search` show totals, top and zero-result queries joined with `analytics_search_queries`, clicks by position, surfaces, and how searching sessions arrived.

## Conventions

- UI copy and place, quest, and legal content: Russian. Docs, ADRs, this file, the README, and code comments: English. Do not use em dashes in UI chrome or in the HTML title. The title pattern is `{title} | K39`, or `{seoTitle} | K39` when that field is set. Do not append a second type word.
- No hacks. Prefer a long-term solution in the existing architecture.
- The public site is simple server-rendered HTML for bots and people.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`). The pre-commit hook runs `check:repo` and lint-staged. commitlint rejects a body line over 100 characters and prints a wrap example. Do not add a `Co-authored-by` trailer. `pnpm install` runs `scripts/git/chain-hooks.mjs`, which keeps `core.hooksPath` on the cloud commit-msg dispatcher and points that dispatcher at `.husky`, so the secrets scanner still runs. The cloud hook set has no `post-commit` name, so the script adds one. The dispatcher appends the trailer after the repository `commit-msg` hook, and that `post-commit` runs `scripts/git/strip-coauthor.sh`. CI rejects a commit that still has the trailer.
- Architecture decisions: `docs/adr/NNNN-title.md`. The index and the heading template are `docs/adr/README.md`. Numbers are unique. Fetch `origin/main` and take the next number from that index. Land the ADR on `main` before the implementation PR. A new `verification_queue` reason is added to `QUEUE_REASONS`, the check constraint, and ADR 0033 in the same change.
- Migrations: `packages/database/migrations/REGISTRY.md`. Fetch `origin/main` and take the next prefix. Drizzle snapshots stop at `0003`, so `db:generate` does not choose the number. CI and the pre-commit hook run `check:repo`, so a missing registry row fails before the commit.
- Admin fetch: pages that load or save during setup use `useRequestFetch()`, as `PlaceForm.vue` does. That forwards the session cookie and the request host during server render. Do not import `ofetch` for an admin URL. A relative `ofetch('/api/admin/...')` has no base URL on the server and does not send the incoming cookie. A button handler after hydration may use `$fetch`.
- Unhead dedupes `<link>` on `rel` and `href` unless each tag has its own `key`. `brandHeadLinks` in `shared/seo.ts` keeps distinct keys for the two `favicon.ico` links.
- Facts: the claim, the column, the source kind, and the freshness window are `docs/facts.md`. Do not copy that table.
- Vue files: template, then script, then style. ESLint is `@antfu/eslint-config` with the local overrides in `eslint.config.mjs`.

## UI

For any UI change, read `.agents/skills/k39-ui/SKILL.md` first. It points at `.agents/skills/frontend-design/SKILL.md` and holds the K39 precedence. That file is Anthropic's frontend-design skill, copied verbatim from https://github.com/anthropics/skills (`skills/frontend-design`), with its Apache-2.0 `LICENSE.txt` in the same folder. `.cursor/rules/frontend-design.mdc` points at `k39-ui` for Vue and CSS files.

## Skills

Read the skill before the matching task. Files are `.agents/skills/<name>/SKILL.md`, the single project skill directory discovered by both Codex and Cursor. Do not keep copies in tool-specific skill directories. `AGENTS.md`, ADRs, and `k39-ui` take precedence over general `frontend-design` advice. Repository paths in skills are relative to the repository root; bundled resources are relative to the skill directory. `pnpm run check:repo` validates skill frontmatter and internal skill paths. The writing stop-list has one source, `apps/web-app/shared/writing.ts`. `content_guide` prints it. Do not add a banned phrase only in a skill.

| Skill | When to use |
| --- | --- |
| `k39-writing` | Russian copy for a place, venue, route, collection, quest, or hub. |
| `k39-sources-and-facts` | A source, a photo, an hour, a price, or any other fact. |
| `k39-price-anchors` | «Ориентиры цен»: matching a menu line to the catalog. |
| `k39-venue-page` | A venue page: modules, passport, links. |
| `k39-publish-review` | The author checklist, then the separate reviewer pass, before publish. |
| `k39-ui` | Any UI change. Read it before `frontend-design`. |
| `frontend-design` | Craft and anti-generic taste during a UI change, after `k39-ui`. |

## Cloud agents

Start from a fresh `origin/main`. The environment build and the boot script fetch it. Before the first edit:

```bash
git fetch origin main
git checkout -B <branch> origin/main
bash scripts/git/sync-branch.sh origin/main
```

Before the first edit, and again when a follow-up says the branch was updated, run `bash scripts/git/sync-branch.sh`. It fetches `origin` and fast-forwards the current branch when that is a fast-forward. Local commits stay. A base ref (`bash scripts/git/sync-branch.sh origin/main`) also fast-forwards the current branch to that ref when the worktree is clean and the branch has no commits of its own, which is how a branch cut from a stale `main` catches up. A dirty worktree or a local commit blocks that reset. Boot runs the script with no arguments (`.cursor/start.sh`). The platform does not wait for that script, so the command above is what an agent can rely on. Fetch again and rebase onto `origin/main` before opening the pull request.

Node is 24.21.0 (`.nvmrc`, the same version as the web image). `scripts/env/node-path.sh` runs on install and on boot. It puts that Node ahead of `/exec-daemon/node` for shells that do not source `/etc/profile.d`. It does not link a tool onto itself when that binary is already the file in the destination directory. Postgres 18 is local. `DATABASE_URL` is the dev database `k39`. `DATABASE_URL_TEST` is `k39_test`. `.cursor/start.sh` creates both databases, then `scripts/env/migrate-dev.sh` applies Drizzle migrations to the local dev database so `k39` has tables before the app boots. It refuses a non-local host and a name ending in `_test`. The test suite still migrates `k39_test`. Content import stays on app boot. Playwright Chromium is installed during the environment build. `scripts/env/check-boot.sh` checks that `node` is the `.nvmrc` version, that Postgres 18 accepts connections on 127.0.0.1, that `public.places` exists on the dev database, and that `/etc/profile.d/k39.sh` exists. `.cursor/start.sh` runs the check last. A miss prints what is missing and exits non-zero. `pnpm dev` binds `0.0.0.0:3000` with telemetry off, so `curl http://127.0.0.1:3000` reaches it and the process does not wait on a prompt.

An editor session without OAuth exists only for local `nuxt dev`. Start the server with `DEV_EDITOR_SESSION=1`. It writes a token file under the temp directory, mode 0600. `pnpm dev:editor-session` prints `http://127.0.0.1:3000/api/dev/editor-session?token=...`. Open that URL. The route returns 404 unless every guard holds: the process is `nuxt dev` (`import.meta.dev`), `NODE_ENV` is not `production`, `DEV_EDITOR_SESSION` is exactly `1`, the token matches the file, `Host` is loopback, and a socket address, when the dev proxy provides one, is loopback. A production build does not write the token and cannot mint the session. The seeded user is `dev-editor@localhost` with the editor role.

The task prompt that launches an agent is not a file in this repo. The fetch above is what this repo can enforce.

## Run

```bash
pnpm install
cp apps/web-app/.env.example apps/web-app/.env
pnpm --filter @k39/web-app dev
pnpm media:rebuild
```

`pnpm media:rebuild` regenerates photo variants from masters already on disk. It needs `DATABASE_URL` and `MEDIA_DIR`.

Dev server: http://127.0.0.1:3000. `nuxt dev` listens on `0.0.0.0` and sets `telemetry: false`, so it does not prompt and it answers IPv4 localhost. Public pages need `DATABASE_URL`. The plugin migrates and seeds before serving traffic. With `DEV_EDITOR_SESSION=1`, `pnpm dev:editor-session` prints a loopback URL that signs in a local editor and redirects to `/admin`. A production build does not serve that session.

Generate a new migration after a schema change, then take the next prefix from `packages/database/migrations/REGISTRY.md` on `origin/main` and add the row:

```bash
pnpm --filter @k39/database db:generate
```

## Test and build

```bash
pnpm run check:quick
pnpm run lint
pnpm run typecheck
pnpm test
pnpm --filter @k39/web-app build
pnpm run check:full
```

`pnpm run check:quick` is the iterate loop. It runs `check:repo`, eslint on files changed against the merge-base of `origin/main` and `HEAD` (committed and uncommitted), the typecheck of each touched package, and vitest on those changed files plus tests related to the changed sources. A `*.writer.test.ts` file is typechecked with the web-app server project, because the database `tsc` project excludes that suffix. A change under `packages/types` typechecks only `@k39/types`. Use the quick loop while editing. `pnpm run check:full` is still required before opening a PR: `check:repo`, eslint --fix, every package typecheck, and the full vitest suite.

`pnpm test` runs the database suite and web-app checks for titles, canonicals, JSON-LD, redirects, robots.txt and orphan links. Set `DATABASE_URL_TEST` to a local database whose name ends with `_test`. If only `DATABASE_URL` is set and it is local, the suite creates and resets the sibling `<name>_test` database and does not drop the dev database. With no URL, tests start Postgres 18 in Testcontainers. A remote URL is refused. `pnpm run check:repo` checks ADR numbers, migration prefixes, journal `idx` and `when` order, tag prefixes, and `Co-authored-by` trailers.

## Deploy

Target: Dokploy.

- Dockerfile: `docker/web-app/Dockerfile`. `nuxt build` copies `apps/web-app/public` into `.output/public`, and that directory is what the image serves. Brand URLs cache for a week. `site.webmanifest` caches for a day.
- Build context: repository root
- The image enables pnpm with Corepack at the version in `packageManager` (`pnpm@10.25.0`). Do not `npm install -g pnpm`: that installs a newer pnpm, which then re-execs the pin. Build with `pnpm --filter @k39/web-app build`. `pnpm build --filter ...` appends `--filter` to the root script and then to `nuxt build`. The builder copies `scripts/git/chain-hooks.mjs` before `pnpm install`, because `prepare` runs it and the image context has no `.git`.
- The container runs as the image's `node` user (uid 1000). `node:24.21.0-alpine` already owns that uid, so the Dockerfile does not create another user. Mount a volume at `MEDIA_DIR` (`/app/media`) or uploads disappear on redeploy.
- CI job `docker` in `.github/workflows/ci.yml` runs that image build on pull requests.
- Port: 3000
- Auto-deploy: push to `main`
- Required env: `DATABASE_URL`, `NUXT_SESSION_PASSWORD` (32+ characters), `NODE_ENV=production`. `DEV_EDITOR_SESSION` is local `nuxt dev` only. A production build ignores it.
- Optional env: OAuth client id/secret pairs, `ADMIN_EMAILS`, `CONTENT_API_TOKEN`, `CONTENT_DRAFT_TOKEN`, `NUXT_PUBLIC_YANDEX_MAPS_API_KEY`, `NUXT_PUBLIC_PMTILES_URL` (https override only), `NUXT_BASEMAP_FILE`, `BASEMAP_SOURCE_URL`, `BASEMAP_SHA256`, `NUXT_PUBLIC_YANDEX_VERIFICATION`, `NUXT_PUBLIC_GOOGLE_VERIFICATION`, `CLAIM_EMAIL_URL`, `CLAIM_SMS_URL`, `CLAIM_DELIVERY_TOKEN`. The basemap source and hash have defaults in the image. Claim code delivery stays off until those URLs are set. The draft token is the one cloud agents use. See ADR 0035.
- Volume: mount a writable directory at `/app/basemap` so the downloaded PMTiles file survives a redeploy. The file is not in the image. The map still loads from OpenFreeMap when the file is absent.
- Volume: mount a writable directory at `MEDIA_DIR` (image default `/app/media`, process uid 1000). Without the volume, uploads vanish on redeploy.

There is no separate migration job. On boot the Nitro plugin (`server/plugins/01.database.ts`) runs Drizzle migrations from `MIGRATIONS_FOLDER` (the image sets `/app/migrations`) and then applies the one-time content import. The migrate is idempotent. Search console steps are documented in `docs/search-consoles.md` and are not configured from this repo. Empty `NUXT_PUBLIC_YANDEX_VERIFICATION` and `NUXT_PUBLIC_GOOGLE_VERIFICATION` add no meta tags.

`www.k39.online` returns 301 to `https://k39.online` plus the path and query. Other hosts are unchanged, so container health checks on localhost keep working.

`/api/health` runs `select 1` and is the image health check.

Do not add Kubernetes manifests or GitHub Actions deploy workflows.

## Pages

- `/{slug}`: place. Hub, nearest, same-region, routes, collections, manual related links. JSON-LD matches the category.
- Hubs: `/forty`, `/zamki`, `/plyazhi`, `/kurorty`, `/muzei`, `/eda`. A hub stores a markdown `body`, rendered with the place article renderer. A `## Частые вопросы` section adds FAQPage. `hub_update` writes the body and the SEO fields and is audit-logged. `/admin` edits the same fields.
- `/map`: full-bleed visitor map. Filter query is `noindex`; the canonical is `/map`. `/map/forty` is a normal 404 and is not in the sitemap.
- `/marshruty`, `/podborki`, `/kvesty` and their slugs. A collection with `modules` renders as a module page (ADR 0023): month chips, lead, month stats, a chip picker that reorders and marks cards (URL params `i`, `c`, `t`, canonical to the clean page, `noindex`), ideas, day plans, place cards, and text sections. Such a page has no map of mentioned places. The modules are the article: a save derives `body` from them, rejects a different `body`, and returns `renderedFields`. Module shapes are `apps/web-app/shared/page-modules.ts`.
- `/gde-deshevle` and `/gde-deshevle/{region}` list cities and benchmark items with at least three fresh official menu prices (ADR 0039). `/ceny/{item}` and `/ceny/{item}/{region}` list the venues, cheapest first. A page is in the sitemap only at five venues. Packaged juice is not the orange-juice row.
- `/zavedeniya` and `/zavedeniya/{slug}`. Listings are a card grid of `VenueCard` (cover, kind, live status), with optional modules around the grid (`venue_listing_modules_set`: «Как выбрать», «По ситуации», «Районы и улицы», «Сезонность», «Вопросы»). Above the grid, towns and kinds are separate link groups: town cards (the town hub photo or illustration, plus a count) and kind chips. A town listing also embeds `MapEmbed` for those venues. Filter URLs such as `/zavedeniya/svetlogorsk/kofe` are indexable when a listing intro is set. Place and route pages list nearby food venues.
- `/admin`: editors and admins. `/preview/{slug}` shows a draft to those users and is `noindex`. A place, route, or collection with a `content_drafts` row shows that pending draft on its edit form: each changed field, live beside draft. Apply publishes through the same writer as `content_set_publication`. Discard deletes the row. A save is refused until the editor chooses to drop the draft. Published or closed venues stage fields, opening schedule, menu prices, and notices in `content_drafts` (ADR 0047). Quests and listings stay on the refusal.
- `/sign-in`, `/about`, `/privacy`, `/terms`. `/cookies` redirects to `/privacy#cookies`. `/legal/privacy-policy` redirects to `/privacy`.

Sitemap source: `server/routes/sitemap-urls.get.ts` (published, indexable rows only). Robots: `public/robots.txt`, served as-is so the Yandex `Host` line stays.
