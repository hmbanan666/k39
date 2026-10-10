# AGENTS.md

## Product

K39 (https://k39.online) is a Russian-language SEO site for tourists in Kaliningrad Oblast. One page per place (forts, castles, beaches, resort towns, food). Illustrated SVG maps in a museum-booklet style, not tile maps. Routes and quests (visit points, progress in the browser). Later, local businesses create offers (a discount or a booking) attached to a place or a route and pay per result: a redeemed one-time code or a confirmed booking. Auction bids come after that. Every consented user action is stored as an event for aggregated, anonymized location analytics. Consent is required under 152-FZ.

Out of scope for this base: an internal messenger, booking through Dostigus agents, payment capture, and tile maps.

The UI and place articles are Russian. Docs, ADRs, and code comments are English.

## Architecture

Monorepo (pnpm):

- `apps/web-app`: Nuxt 4, `@nuxt/ui`, `@nuxtjs/seo`, `@nuxt/content`, `nuxt-auth-utils`.
- `packages/database`: Drizzle ORM and Postgres. Schema, repositories, SQL migrations.
- `packages/types`: Zod schemas shared by the API.

Place articles live in `apps/web-app/content/places/*.md` (frontmatter: slug, type, coordinates, status `open` | `ruins` | `unknown`, hours, source URL, region). Quest copy lives in `content/quests`. Offers, offer codes, and events live in Postgres.

The same places, the Kaliningrad region, the "five forts" route, and its quest steps are upserted into Postgres on boot from `apps/web-app/shared/data/catalog.json`, so offers and events can reference real rows. Regenerate markdown and the catalog with `node tools/build-place-content.mjs` after editing `apps/web-app/app/data/forts/objects.json`. To refresh that JSON from the static prototype, pass the prototype directory.

The first illustrated map is the Konigsberg forts, served at `/map/kaliningrad`. The component file is `app/components/map/FortsMap.vue`. Nuxt prefixes that directory, so the tag is `<MapFortsMap>`, not `<FortsMap>`. Geometry is preprojected OpenStreetMap data (ODbL) in `app/data/forts/geo.json`.

Auth is Yandex and VK OAuth only. Empty client id or secret disables that provider. The process still boots.

`POST /api/events` records an event. `useTrack()` sends one only after the visitor accepts the consent banner. The anonymous session id is an httpOnly cookie set on that request. Rows require `consent = true`. The table has no IP address and no account id.

## Conventions

- User-facing UI copy and place/quest/legal content: Russian. Do not use em dashes in UI text.
- ADRs, this file, the README, code comments: English.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`). Husky runs lint-staged and commitlint.
- Architecture decisions: `docs/adr/NNNN-title.md`.
- Vue files: template, then script, then style. ESLint is `@antfu/eslint-config` with the local overrides in `eslint.config.mjs`.

## Run

```bash
pnpm install
cp apps/web-app/.env.example apps/web-app/.env
pnpm --filter @k39/web-app dev
```

Dev server: http://localhost:3000. Without `DATABASE_URL` the content pages still render. With it, the Nitro plugin migrates and syncs the catalog before serving traffic.

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

`pnpm test` runs the database suite and a web-app smoke test that renders the fort 11 place view and checks TouristAttraction JSON. Point `DATABASE_URL` at a local database to skip Docker. The suite drops the `public` schema of that database when the host is localhost. Do not point it at a shared database.

## Deploy

Target: Dokploy.

- Dockerfile: `docker/web-app/Dockerfile`
- Build context: repository root
- The image enables pnpm with Corepack at the version in `packageManager` (`pnpm@10.25.0`). Do not `npm install -g pnpm`: that installs a newer pnpm, which then re-execs the pin. Build with `pnpm --filter @k39/web-app build`. `pnpm build --filter ...` appends `--filter` to the root script and then to `nuxt build`.
- The container user owns `/app`. Nuxt Content creates a sqlite file there on boot. If that directory is not writable, place pages 404.
- CI job `docker` in `.github/workflows/ci.yml` runs that image build on pull requests.
- Port: 3000
- Auto-deploy: push to `main`
- Required env: `DATABASE_URL`, `NUXT_SESSION_PASSWORD` (32+ characters), `NODE_ENV=production`
- Optional env: `NUXT_OAUTH_YANDEX_CLIENT_ID`, `NUXT_OAUTH_YANDEX_CLIENT_SECRET`, `NUXT_OAUTH_VK_CLIENT_ID`, `NUXT_OAUTH_VK_CLIENT_SECRET`

There is no separate migration job. On boot the Nitro plugin (`server/plugins/01.database.ts`) runs Drizzle migrations from `MIGRATIONS_FOLDER` (the image sets `/app/migrations`) and then upserts the catalog. The migrate is idempotent.

`www.k39.online` returns 301 to `https://k39.online` plus the path and query. Other hosts are unchanged, so container health checks on localhost keep working.

`/api/health` runs `select 1` and is the image health check.

Do not add Kubernetes manifests or GitHub Actions deploy workflows.

## Pages

- `/place/[slug]`: article, source link, Yandex route link, `TouristAttraction` JSON-LD.
- `/map/[region]`: illustrated forts map for `kaliningrad`. Other regions say the map is not drawn yet.
- `/quest/[slug]`: quest steps linking to places.
- `/sign-in`: Yandex and VK, or a disabled message.
- `/legal/privacy-policy`.

Sitemap source: `server/api/__sitemap__/urls.ts`.
