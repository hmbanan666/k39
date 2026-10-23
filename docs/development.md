# Development and deployment

Use [AGENTS.md](../AGENTS.md) for the mandatory task entry point and code map. Read the section needed for your environment or change. Paths below are relative to the repository root unless they start with `server/`, which is under `apps/web-app/`.

## Toolchain and local setup

The Node pin is `.nvmrc`; the pnpm pin is `package.json#packageManager`. Verify the commands your shell actually resolves with `node --version` and `pnpm --version`. Use Corepack for the pinned package manager. Do not change repository pins to match an unrelated host default or relax dependency trust policy to make an install pass.

A portable preflight is `node scripts/env/check-toolchain.mjs` (or `pnpm run check:toolchain` once pnpm resolves). It checks the exact pins using the commands this shell runs and exits non-zero on a mismatch. It checks Node before invoking a pnpm shim. It does not install tools, rewrite profiles, inspect credentials, migrate a database or certify application readiness. The pnpm version probe can use Corepack's normal pin resolution; prepare the manager first if downloads must be avoided.

Select the Node in `.nvmrc` with your existing version manager. If you need Corepack shims without changing global tool links, use a directory for this shell:

```bash
k39_shims="$(mktemp -d)"
corepack enable --install-directory "$k39_shims"
export PATH="$k39_shims:$PATH"
node scripts/env/check-toolchain.mjs
```

Then install and configure the local database as below. A successful toolchain preflight is separate from Postgres connectivity, migrations and a responding SSR page.

```bash
corepack pnpm install --frozen-lockfile
test -f apps/web-app/.env || cp apps/web-app/.env.example apps/web-app/.env
pnpm --filter @k39/web-app dev
pnpm media:rebuild
```

`pnpm media:rebuild` regenerates photo variants from masters already on disk. It needs `DATABASE_URL` and `MEDIA_DIR`.

Dev server: http://127.0.0.1:3000. `nuxt dev` listens on `0.0.0.0` and sets `telemetry: false`, so it does not prompt and it answers IPv4 localhost. Public pages need `DATABASE_URL`. The plugin migrates and seeds before serving traffic. With `DEV_EDITOR_SESSION=1`, `pnpm dev:editor-session` prints a loopback URL that signs in a local editor and redirects to `/admin`. A production build does not serve that session.

Generate a new migration after a schema change, then take the next prefix from `packages/database/migrations/REGISTRY.md` on `origin/main` and add the row:

```bash
pnpm --filter @k39/database db:generate
```

## Environments

A generic checkout needs the pinned tools and a local Postgres 18 database (or Docker for the test suite). The committed Cursor image and its boot scripts are one environment adapter, not prerequisites satisfied automatically on every host. Do not run the Linux/exec-daemon PATH rewriting adapter on macOS or another managed host just because it exists in this repository.

For the matching Cursor image, `bash scripts/env/check-boot.sh` reports missing prerequisites. It checks an image-specific profile as well as Node and Postgres; absence of `/etc/profile.d/k39.sh` on a different host is not by itself an application defect.

In the committed Cursor image, Node follows `.nvmrc` (the same version as the web image). `scripts/env/node-path.sh` runs on install and on boot. It puts that Node ahead of `/exec-daemon/node` for shells that do not source `/etc/profile.d`. It does not link a tool onto itself when that binary is already the file in the destination directory. Postgres 18 is local. `DATABASE_URL` is the dev database `k39`. `DATABASE_URL_TEST` is `k39_test`. `.cursor/start.sh` creates both databases, then `scripts/env/migrate-dev.sh` applies Drizzle migrations to the local dev database so `k39` has tables before the app boots. It refuses a non-local host and a name ending in `_test`. The test suite still migrates `k39_test`. Content import stays on app boot. Playwright Chromium is installed during the environment build. `scripts/env/check-boot.sh` checks that `node` is the `.nvmrc` version, that Postgres 18 accepts connections on 127.0.0.1, that `public.places` exists on the dev database, and that `/etc/profile.d/k39.sh` exists. `.cursor/start.sh` runs the check last. A miss prints what is missing and exits non-zero. `pnpm dev` binds `0.0.0.0:3000` with telemetry off, so `curl http://127.0.0.1:3000` reaches it and the process does not wait on a prompt.

An editor session without OAuth exists only for local `nuxt dev`. Start the server with `DEV_EDITOR_SESSION=1`. It writes a token file under the temp directory, mode 0600. `pnpm dev:editor-session` prints `http://127.0.0.1:3000/api/dev/editor-session?token=...`. Open that URL. The route returns 404 unless every guard holds: the process is `nuxt dev` (`import.meta.dev`), `NODE_ENV` is not `production`, `DEV_EDITOR_SESSION` is exactly `1`, the token matches the file, `Host` is loopback, and a socket address, when the dev proxy provides one, is loopback. A production build does not write the token and cannot mint the session. The seeded user is `dev-editor@localhost` with the editor role.

The task prompt that launches an agent is not a file in this repo. Use the explicit branch-synchronization workflow in AGENTS rather than assuming boot completed.

## Fixtures

`pnpm db:seed:fixtures` upserts test fixtures after migration. It is not boot content and not an article. Slugs: towns `fixture-town` (hub photo via place `fixture-town`) and `fixture-plain` (no photo); venues `fixture-cafe-photo` (photo, coordinates, three prices, schedule, Instagram, every venue module), `fixture-cafe-plain` (no photo, coordinates, prices, schedule), `fixture-cafe-peer` (third price for a band), `fixture-cafe-nocoords`, `fixture-cafe-open` (verified schedule with an opening time and no closing time, ADR 0042), `fixture-cafe-weekdays` (verified weekday hours, weekend hours unknown, ADR 0044), `fixture-cafe-seasons` (two seasons, a monthly closure, and an exception, so the venue forms show the hours read-only); places `fixture-stop`, `fixture-contact` (phone, website, schema subtype `Church`; public in the `muzei` hub once boot content exists), `fixture-museum` (ticket table, two upcoming events, one past and one cancelled event that never render, ADR 0046), and `fixture-tickets-stale` (only stale ticket rows); route `fixture-route` (both places as stops, its own ticket row); collection `fixture-modules` (every page module, `fixture-museum` among the items). Dated notices (ADR 0049), relative to the seed day: `fixture-cafe-photo` has a current relocation and an expired row, `fixture-cafe-plain` an upcoming `closed`, and `fixture-contact` a current `closed` and an upcoming renovation. The 32 price-catalog slugs are `PRICE_CATALOG` in `packages/database/src/seed/price-catalog.ts`. A second run updates those rows. Pages are `noindex`.

## Checks

During implementation:

```bash
pnpm run check:quick
```

Final gate before opening a PR:

```bash
pnpm run check:full
pnpm --filter @k39/web-app build
```

`check:full` runs repository validation, read-only lint, every package typecheck and the full test suite. It does not autoformat source files. Run `pnpm run lint:fix` explicitly when needed and inspect the diff before the final gate. Typechecks still generate ignored Nuxt files; tests still write to the isolated test database. Individual lint, typecheck and test commands are useful for diagnosis; they are not extra steps to repeat after the full gate has passed.

Use `K39_CHECK_TIMINGS=1 pnpm run check:quick` to emit one JSON timing record after each executed stage, including a failed stage. Times use a monotonic clock; selection, order, commands and exit codes are unchanged. Timings are opt-in. The [A01 baseline](reviews/2026-10-23-agent-loop/README.md) records host/cache scope and a real feature-change workload; compare equivalent work and environments before claiming a speedup.

`pnpm run check:quick` is the iterate loop. It runs `check:repo`, eslint on files changed against the merge-base of `origin/main` and `HEAD` (committed and uncommitted), typechecks for touched packages and their transitive workspace consumers, and vitest on those changed files plus tests related to the changed sources. A `*.writer.test.ts` file is typechecked with the web-app server project, because the database `tsc` project excludes that suffix. The dependency graph comes from workspace manifests, including dev, peer and optional dependencies and packages without a typecheck script. A change under `packages/types` checks `@k39/types`, `@k39/database` and `@k39/web-app`; a map change checks map and web. Consumers follow their selected dependencies. Root configuration changes and unknown removed workspace packages conservatively check all packages. A writer-test-only change retains the focused server-project check; other database changes include the full web typecheck. The final gate remains the full command above.

`pnpm test` runs the database suite and web-app checks for titles, canonicals, JSON-LD, redirects, robots.txt and orphan links. Set `DATABASE_URL_TEST` to a local database whose name ends with `_test`. If only `DATABASE_URL` is set and it is local, the suite creates and resets the sibling `<name>_test` database and does not drop the dev database. With no URL, tests start Postgres 18 in Testcontainers. A remote URL is refused. `pnpm run check:repo` checks ADR numbers, migration prefixes, journal `idx` and `when` order, tag prefixes, and `Co-authored-by` trailers.

## Branch synchronization

Use the task-start commands in [AGENTS.md](../AGENTS.md#start-a-task). `scripts/git/sync-branch.sh` fetches origin and fast-forwards the current branch when possible. With `origin/main` as a base, it also catches up a clean branch that has no commits of its own. Dirty worktrees and local commits are preserved. `.cursor/start.sh` runs the script without a base; the platform does not wait for that script, so an agent must explicitly synchronize before editing. Synchronize again when a follow-up says the branch was updated; fetch and rebase onto origin/main before opening the PR.

## Commit hooks

Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`). The pre-commit hook runs `check:repo` and lint-staged. commitlint rejects a body line over 100 characters and prints a wrap example. Do not add a `Co-authored-by` trailer. `pnpm install` runs `scripts/git/chain-hooks.mjs`, which keeps `core.hooksPath` on the cloud commit-msg dispatcher and points that dispatcher at `.husky`, so the secrets scanner still runs. The cloud hook set has no `post-commit` name, so the script adds one. The dispatcher appends the trailer after the repository `commit-msg` hook, and that `post-commit` runs `scripts/git/strip-coauthor.sh`. CI rejects a commit that still has the trailer.

## Deploy

Target: Dokploy.

- Dockerfile: `docker/web-app/Dockerfile`. `nuxt build` copies `apps/web-app/public` into `.output/public`, and that directory is what the image serves. Brand URLs cache for a week. `site.webmanifest` caches for a day.
- Build context: repository root
- The image enables pnpm with Corepack at the version in `packageManager`. Do not `npm install -g pnpm`: that installs a newer pnpm, which then re-execs the pin. Build with `pnpm --filter @k39/web-app build`. `pnpm build --filter ...` appends `--filter` to the root script and then to `nuxt build`. The builder copies `scripts/git/chain-hooks.mjs` before `pnpm install`, because `prepare` runs it and the image context has no `.git`.
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
