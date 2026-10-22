# K39

[K39](https://k39.online) is a Russian-language site for tourists in Kaliningrad Oblast. Every place (forts, castles, beaches, resort towns, food) gets its own page, and a visitor map, routes and quests tie them together. Local businesses will later attach pay-per-result offers to places and routes.

This repository is the clean base for that product. The earlier social product (reviews, follows, pins, feed, advent calendar, badges) has been removed.

The UI and place articles are in Russian. Documentation, ADRs and code comments are in English.

## Features

- **Place pages** at `/{slug}`, with hubs for forts, castles, beaches, resorts, museums and food.
- **Visitor map** at `/map`, built on MapLibre GL with a self-hosted PMTiles basemap and an OpenFreeMap fallback.
- **Routes, collections and quests** with progress stored in the browser.
- **Venues** (cafes and restaurants) with schedules, price anchors and a verified-facts layer.
- **Site search** powered by Postgres full-text search and `pg_trgm`.
- **Admin area** at `/admin` for editors, plus a cabinet at `/kabinet` where venue owners can claim and edit their listing.
- **Content MCP server** at `/mcp` so editors and agents can read and write content through audited tools.
- **Cookieless page analytics** with no IP storage.
- **SEO-first rendering**: published pages are server-rendered from Postgres.

## Stack

| Area      | Technology                                                       |
| --------- | ---------------------------------------------------------------- |
| App       | Nuxt 4, Vue, Reka UI (headless), `@nuxtjs/seo`, `nuxt-auth-utils` |
| Styling   | Local CSS tokens (no Tailwind, no `@nuxt/ui`)                    |
| Database  | PostgreSQL, Drizzle ORM                                          |
| Maps      | MapLibre GL, PMTiles                                             |
| Images    | `sharp` (AVIF and WebP variants)                                 |
| Validation| Zod                                                              |
| Tooling   | pnpm workspaces, ESLint, Vitest, Husky, commitlint               |
| Deploy    | Docker on Dokploy                                                |

## Repository layout

```
apps/web-app        Nuxt application (pages, server API, admin, MCP)
packages/database   Drizzle schema, repositories, SQL migrations, seed
packages/types      Zod schemas shared by the API
docker/web-app      Dockerfile for the production image
docs                Design system, ADRs, facts, roadmap and other guides
scripts             Repository and git helper scripts
.agents/skills      Shared Agent Skills for Codex and Cursor
.cursor             Cursor rules and cloud environment
```

## Getting started

Requirements: Node.js (the exact version is in `.nvmrc`), the exact pnpm version from `package.json` via Corepack, and a PostgreSQL database. Avoid using an unrelated global pnpm version.

```
corepack pnpm install --frozen-lockfile
cp apps/web-app/.env.example apps/web-app/.env
pnpm --filter @k39/web-app dev
```

The app listens on <http://127.0.0.1:3000>.

Public pages are rendered from Postgres, so set `DATABASE_URL` in `apps/web-app/.env` first. On startup the server applies Drizzle migrations and inserts the initial content once. Login needs the optional OAuth variables (Yandex, VK). An empty `ADMIN_EMAILS` is fine: the site still serves public pages, and nobody is promoted to admin until you set it.

Useful extras:

```
pnpm db:seed:fixtures   # upsert test fixtures after migration (pages are noindex)
pnpm media:rebuild      # regenerate photo variants from masters on disk
```

For screenshot or agent runs, `NUXT_DEVTOOLS=0 pnpm --filter @k39/web-app dev --no-tui` hides the devtools badge and streams logs. Without `MEDIA_DIR`, development stores uploads under `.data/media` relative to the app's working directory; production keeps the image default `/app/media`. The committed Cloud Agent boot check is `bash scripts/env/check-boot.sh`. A personal Cursor dashboard environment can override the committed image and must be checked in that dashboard when the boot check reports missing prerequisites.

For local `nuxt dev` without OAuth, start the server with `DEV_EDITOR_SESSION=1` and run `pnpm dev:editor-session` to get a loopback sign-in URL. A production build ignores this.

## Checks

```
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

Database tests use `DATABASE_URL_TEST` when it is set. A local `DATABASE_URL` is rewritten to a sibling database whose name ends with `_test`, so the dev database is never dropped. With no URL, the tests start Postgres with Testcontainers, which needs Docker.

`pnpm run check:repo` verifies ADR numbers, migration prefixes and commit trailers. It also runs in the pre-commit hook and in CI.

## Configuration

| Variable                                     | Purpose                                                  |
| -------------------------------------------- | -------------------------------------------------------- |
| `DATABASE_URL`                               | Postgres connection (required)                           |
| `NUXT_SESSION_PASSWORD`                      | Session cookie secret, 32 or more characters (required)  |
| `NODE_ENV`                                   | Set to `production` in deployment (required)             |
| `ADMIN_EMAILS`                               | Accounts promoted to admin on login                      |
| `CONTENT_API_TOKEN`, `CONTENT_DRAFT_TOKEN`   | Editor and draft-only bearers for the content API and MCP |
| Yandex and VK OAuth id/secret pairs          | Enable each login provider                               |
| `NUXT_BASEMAP_FILE`, `BASEMAP_SOURCE_URL`, `BASEMAP_SHA256` | Self-hosted basemap (defaults are baked into the image) |
| `MEDIA_DIR`                                  | Where uploaded photos are stored                         |

See `apps/web-app/.env.example` for the full list. Never commit token values.

## Content workflow

Place text is markdown stored in the database. After the first boot, content changes happen in `/admin`, through `POST` and `PATCH /api/content/places`, or through the MCP server at `https://k39.online/mcp`. All of them go through the same writer, which normalizes the prose, runs the stop-list and keeps an audit trail.

- The **editor token** can publish and edit live content.
- The **draft token** is for agents: its writes land as drafts or a pending review and it cannot publish.

Writing rules, fact sources and the publish checklist live in the skills under `.agents/skills/`.

This is the single skill directory for [Codex](https://developers.openai.com/codex/skills/) and [Cursor](https://cursor.com/docs/skills). Both discover project skills there. `AGENTS.md`, ADRs, and `k39-ui` take precedence over general `frontend-design` advice. Cursor keeps its scoped UI entry point in `.cursor/rules/frontend-design.mdc`; it reads the same `k39-ui` file.

Run `pnpm run check:repo` to parse every skill's YAML frontmatter, validate its name and description, check local Markdown links and explicit resource/repository paths, and reject stale skill paths. It also checks concrete `.agents/skills/` references in repository text files. Placeholder paths such as `<name>` are excluded.

To check discovery after a checkout or reload, open a new Codex session from the repo root (or `apps/web-app`) and check `/skills` for all seven project skills. In Cursor, open the repository and check Customize → Skills, or type `/k39-ui` in Agent chat. The metadata should resolve to `.agents/skills/`; no tool-specific copies or symlinks are needed.

## Deployment

The target is Dokploy. It builds `docker/web-app/Dockerfile` with the repository root as context, exposes port 3000 and auto-deploys pushes to `main`. Pull requests also build the image in CI.

- Mount a writable volume at `MEDIA_DIR` (`/app/media`), or uploads disappear on redeploy.
- Mount a writable volume at `/app/basemap` so the downloaded PMTiles file survives a redeploy.
- `/api/health` is the image health check.
- Migrations run on boot, so there is no separate migration job.

## Contributing

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
- Architecture decisions are recorded in `docs/adr/`. The index and template are in `docs/adr/README.md`.
- Database migrations are tracked in `packages/database/migrations/REGISTRY.md`.
- For architecture, conventions and agent instructions, read [AGENTS.md](AGENTS.md) before making changes.

## License

[MIT](LICENSE)
