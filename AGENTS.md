# AGENTS.md

K39 is a Russian-language travel guide to Kaliningrad Oblast. Public pages are server-rendered from Postgres. The monorepo uses Nuxt 4, Vue, Reka UI (headless), local CSS tokens, Drizzle and pnpm. There is no Tailwind or `@nuxt/ui`. Runtime pins are `.nvmrc` and `package.json#packageManager`. Internal messaging, booking through Dostigus agents and payment capture remain out of scope.

Use this file as the task entry point. Read the matching skill and the relevant section of [development](docs/development.md) or [application reference](docs/content-system.md); do not load every guide or ADR for every task. Verify behavior against code and tests: an accepted ADR records a decision, not proof that every phase is implemented.

## Start a task

Use a clean checkout or isolated worktree; preserve existing changes and local commits. Before the first edit, synchronize, then create a new branch from the fetched main:

```bash
git status --short
bash scripts/git/sync-branch.sh origin/main
git checkout -b <new-branch> origin/main
```

Run `bash scripts/git/sync-branch.sh` again when a follow-up says the branch was updated. Fetch and rebase onto `origin/main` before opening the PR. The boot script is asynchronous; do not assume it already synchronized the checkout.

Install with `corepack pnpm install --frozen-lockfile`. Verify that `node` and `pnpm` resolve to the project pins. See [environment setup](docs/development.md#environments) for local Postgres, Cursor-specific boot checks, fixtures and the guarded dev editor session.

## Invariants

- UI copy, articles and legal content are Russian. Docs, ADRs and code comments are English. Vue order: template, script, style. No em dashes in UI chrome or HTML titles. Titles use `{title} | K39` or the SEO override; do not append a second type word.
- Prefer a long-term solution in the existing architecture. Investigate a workaround's reason and callers before replacing it. SSR must remain useful for people and bots.
- Article text lives in the database. Do not add articles as committed drafts, seeds or page files, or add another one-time content bootstrap. Content saves use `apps/web-app/server/utils/content/save.ts`; admin, API and MCP must keep sharing the writers.
- The editor bearer can publish; the agent draft bearer cannot. Preserve pending-draft, owner-conflict and live-write restrictions. Neither bearer manages users or settings. Never commit secrets or generate/deploy a content token from an agent. Detailed boundaries: [MCP](docs/content-system.md#content-mcp).
- Keep one schema/writer per domain. Do not duplicate the facts table from `docs/facts.md`, schedule rules or the writing stop-list (`apps/web-app/shared/writing.ts`). Keep MCP helpers in `server/utils/mcp/`, not beside handlers in `server/mcp/`.
- Brand icon binaries change only through `node scripts/brand/render-icons.mjs <master>`; do not re-encode them by hand. UI tokens and sticker rules come from the UI skill.
- Architecture decisions: [ADR index](docs/adr/README.md). Fetch main, allocate a unique number, and land the ADR before its implementation PR. New verification-queue reasons update `QUEUE_REASONS`, the constraint and ADR 0033 together.
- Schema changes: [migration registry](packages/database/migrations/REGISTRY.md). Allocate the next prefix from fresh main and register it; Drizzle snapshots stop at 0003, so generation alone does not choose the number.
- Conventional Commits; body lines at most 100 characters; no `Co-authored-by` trailer. Preserve the cloud secrets-scanner/hook chain. [Hook details](docs/development.md#commit-hooks).
- Deploy is Docker on Dokploy, automatically from main. Preserve media/basemap volumes. Do not add Kubernetes manifests or GitHub Actions deploy workflows. [Deployment details](docs/development.md#deploy).

## Find the implementation

Follow the relevant row, trace the existing reader/writer and its callers, then select related tests. Paths in links are repository-relative; unlinked `server/` paths below are under `apps/web-app/`.

| Task | Start here | Existing checks / notes |
| --- | --- | --- |
| Public page, route, hub or SEO | [pages](apps/web-app/app/pages), [public readers](apps/web-app/server/utils/public-pages.ts), [SEO](apps/web-app/shared/seo.ts) | [SEO tests](apps/web-app/test/seo.test.ts), [render tests](apps/web-app/test/render-page.test.ts); [page reference](docs/content-system.md#pages) |
| Visitor or embedded map | [scene core](packages/map/src), [map components](apps/web-app/app/components/map), [map reader](apps/web-app/server/utils/map) | [core tests](packages/map/test), [availability regression](apps/web-app/test/map-availability.test.ts); [map reference](docs/content-system.md#map-rendering) |
| Venue, menu prices or listings | [venue readers/writers](apps/web-app/server/utils/venues), [venue page](apps/web-app/app/components/VenuePage.vue) | [venue tests](apps/web-app/test/venues.test.ts), [price tests](packages/database/src/repository/test/prices.test.ts); venue/price skills |
| Facts, schedules or notices | [facts](apps/web-app/server/utils/facts), [schedules](apps/web-app/server/utils/schedule.ts), [notices](apps/web-app/server/utils/notices) | [fact reference](docs/facts.md), [facts and verification](docs/content-system.md#facts-and-verification), [notice tests](apps/web-app/test/notices.test.ts) |
| Admin editing, publishing or MCP | [save entry](apps/web-app/server/utils/content/save.ts), [admin API](apps/web-app/server/api/admin), [MCP helpers](apps/web-app/server/utils/mcp) | [save tests](apps/web-app/test/content-save.test.ts), [writer tests](packages/database/src/repository/test); [editing conventions](docs/content-system.md#editing-conventions) |
| Auth, owner cabinet or guest materials | [cabinet flow](apps/web-app/server/utils/cabinet), [guest writers](apps/web-app/server/utils/guests), [cabinet pages](apps/web-app/app/pages/kabinet) | [auth tests](apps/web-app/test/auth.test.ts), [claim tests](packages/database/src/repository/test/claims.test.ts); relevant ownership/guest section in application reference |
| Shared types, SQL or migrations | [types](packages/types/src), [tables](packages/database/src/tables.ts), [repositories](packages/database/src/repository) | [DB tests](packages/database/src/repository/test), migration registry; [test DB rules](docs/development.md#checks) |
| Analytics, scoring or search | [analytics](apps/web-app/server/utils/analytics), [scoring](apps/web-app/server/utils/scoring), [search API](apps/web-app/server/api/search) | [analytics tests](packages/database/src/repository/test/analytics.test.ts), [search tests](packages/database/src/repository/test/search.test.ts), [score tests](apps/web-app/test/scoring.test.ts) |
| Agent setup, checks, CI or image | [scripts](scripts), [Cursor adapter](.cursor), [CI](.github/workflows/ci.yml), [web image](docker/web-app/Dockerfile) | [tooling tests](apps/web-app/test/agent-tooling.test.ts), [quick-check tests](apps/web-app/test/check-quick.test.ts); development guide |

## Skills

Read the skill before its matching task. `.agents/skills/<name>/SKILL.md` is the single skill directory for Codex and Cursor; do not keep tool-specific copies. Repository paths in skills are root-relative, bundled paths skill-relative. AGENTS, ADRs and `k39-ui` take precedence over general `frontend-design` advice.

| Skill | Read for |
| --- | --- |
| `k39-writing` | Russian place, venue, route, collection, quest or hub copy |
| `k39-sources-and-facts` | A source, photo, hour, price or other fact |
| `k39-price-anchors` | Matching a menu line to the price catalog |
| `k39-venue-page` | Venue modules, passport and links |
| `k39-publish-review` | Author checklist, then a separate reviewer pass before publication |
| `k39-ui` | Any UI change; read it before `frontend-design`, including its screenshot requirements |
| `frontend-design` | UI craft after `k39-ui`; `.cursor/rules/frontend-design.mdc` points to the same entry point |

## Verify and hand off

During changes use `pnpm run check:quick`. Before opening a PR run `pnpm run check:full` and `pnpm --filter @k39/web-app build`. The full check already includes repository validation, lint with fixes, all typechecks and the full test suite; inspect its diff. Do not repeat its individual checks without a new failure or change that justifies it.

Database tests use a local database ending in `_test`, or Postgres 18 through Testcontainers when no URL is configured. Preserve the remote/test-database guards. Quick-check package selection, fixture setup and individual diagnostic commands are explained in [checks](docs/development.md#checks).

Describe the concrete trigger, resulting behavior, tested commit and validation limits in the PR. A UI PR includes the before/after evidence required by `k39-ui`. Update the relevant current guide when behavior changes; preserve ADR decision history and distinguish deferred phases from implemented behavior.
