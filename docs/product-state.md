# Product state

Audit: 2026-10-22. Code baseline: `2ab27948cae7569f2b8273548ee4cb29027a889c` (`main`, including PR 283). This is the first implementation inventory and a proposed stabilization scope. It is not whole-product acceptance or a complete architecture/security audit.

## Goals and evidence

The owner reports that features were added incrementally without an overall plan or feature list. Two priorities are now explicit: bring unfinished product capabilities into order before expanding, and make agent development easier and faster. Inspect workarounds encountered along the way; remove them only after understanding their purpose and replacement.

Proposed product objective: help a visitor choose a place in Kaliningrad Oblast, understand whether and how to visit it, and plan an outing with nearby food. Validate scope decisions with the owner rather than treating this objective as an accepted redesign.

**Code** below means inspected implementation, not proof of production readiness. **HTTP** means a read-only production request succeeded on the audit date, not browser interaction or visual acceptance. **Unverified** means the complete scenario was not exercised here. Recommendations are proposals; this audit changes no public route, content, account or production flag.

## Capability inventory

Paths beginning `app/`, `shared/`, or `server/` are under `apps/web-app/`. Counts are production endpoint snapshots, not audited business totals or content-quality measures.

| Capability | Implementation and evidence | Proposed disposition | Required acceptance |
| --- | --- | --- | --- |
| Place articles and six category hubs | `server/utils/public-pages.ts`, `app/pages/[slug].vue`, hub pages; SSR, sources, typed sections and facts | Core: stabilize | Real place answers access, hours, price, travel and source questions; unknown/stale facts are honest |
| Routes and directions | Ordered stops, optional stored geometry, embedded map and external directions; HTTP: 13 route index items | Core: stabilize | Follow a real route on a phone; check order, travel links, closed stops and absent geometry |
| Visitor and embedded maps | `packages/map`, `server/utils/map`, `app/pages/map`; HTTP: 266 points, 13 routes; PR 283 fixes main-map availability failures | Core: stabilize | Mobile/desktop, filter combinations, deep links, missing tiles/WebGL and error recovery |
| Collections and month guides | `app/pages/podborki`, `shared/page-modules.ts`; classic and module layouts; HTTP: 23 collection items, 12 month entries | Keep useful guides; assess presentation complexity | One classic and one module guide must support a concrete trip-planning task |
| Picker and remembered persona | `usePagePicker`, `useVisitorPersona`; URL answers and localStorage hints after hydration | Pilot; defer expansion | Understand/reset ordering, share a link, disable storage, verify SSR/hydration |
| Quests | Quest page shows prose, route, map and stop cards; HTTP: one quest; no completion controls or saved progress found | Rework or reduce promotion | Choose an editorial walk versus an interactive challenge and define success |
| Venue catalog and pages | `server/utils/venues/public.ts`, `VenuePage`, catch-all listing; HTTP: 151 listing items | Supporting core: stabilize a representative set | Place -> nearby food -> venue -> reliable contact/directions |
| Schedules and availability | Rules, intervals, exceptions and unknown states in `shared/schedule`, `server/utils/schedule.ts`, availability API | Core data dependency: retain | Same venue status across page, cards, map and lists at time boundaries |
| Venue listing open-now filter | Listing `toggleOpen()` still catches failed availability as an empty list, separately from PR 283 | Fix | Failure preserves results and shows retry; successful empty result remains distinct |
| Eat-now hub and proximity | `EatNowPage`, `loadEatNow`; browser groups statuses after hydration; HTTP: 13 towns | Pilot; improve feedback | Unknown/closed schedules, denied/timed-out location, no coordinates and no-JS |
| Menu price anchors and bands | `comparable-prices.ts`, `menu-prices.ts`, `shared/price-compare.ts`; official comparison sample separated from owner prices | Keep where evidence exists | Trace item, portion, price, source and freshness across surfaces |
| Where-cheaper and item price pages | `server/utils/venues/price-page.ts`; HTTP: three city entries; fresh-sample thresholds | Pilot with explicit coverage | Thin/missing samples, stale prices, portions, closed venues and crawl thresholds |
| Ticket prices and dated events | `server/utils/practical`, `TicketsFact`, `UpcomingEvents`; source-backed rows and expiry paths | Retain practical facts; defer event-product expansion | Expired/cancelled entries, audiences, prices and JSON-LD agree |
| Temporary closures and relocations | `server/utils/notices`, `TemporaryNotices`, `shared/notices.ts`; notices affect availability without moving stored coordinates | Retain; verify cross-surface behavior | Future/current/expired closure and relocation on page, cards, map and API |
| Site search | Search API, database repository, `/poisk`, reporting | Core: stabilize | Russian forms, typo/transliteration, zero results, draft/archive exclusion and navigation |
| Admin editing and draft review | `server/utils/content/save.ts`, admin draft endpoints, `content_drafts`; several writer tests exist; signed-in flow unverified | Operational core: retain | Draft, compare, concurrent edit, apply, discard and archive per entity |
| Content MCP and token boundaries | 91 tool definition files, strict wrapper, editor/draft capabilities; no production writes here | Operational core: retain | Editor/draft/absent-token matrix on fixtures; live-write staging/refusal and audits |
| Facts, verification queue and source watcher | `server/utils/facts`, refs, revisions and queue; public phase-2 projection exists for selected kinds | Retain; assess complexity through the workflow | Source change/failure, TTL, gap, column fallback and owner conflict through to public output |
| Media processing and storage | Ingestion utilities, sharp variants and attachment relations; upload and volume durability unverified | Operational core: retain | License/source, failed ingest, references on deletion and redeploy persistence |
| OAuth and personal cabinet | Production provider endpoint lists Yandex and VK; profile, venue membership and guest rows exist; no login attempted | Pilot; require a tourist-account use case | Login/logout, consent, redirects, expiry, roles and meaningful empty state |
| Venue claims and owner editing | Code/manual claims, membership and revisions; delivery depends on transports; production delivery unverified | Controlled business pilot | Claim -> approve -> restricted edit -> review/conflict -> revoke; expiry and delivery failure |
| Guest reviews, tips, photos and corrections | Guest form/block, moderation and cabinet rows; not the removed legacy social system | Pilot with a moderation owner | Submit, approve/reject, withdraw, photo rules and correction-to-queue flow |
| Analytics, scores and editorial personas | Separate collect/search paths, passports, jobs, coverage and reports; `useTrack` defaults off | Internal tools: retain and validate usefulness | Report/funnel accuracy, job freshness and decisions supported; score is not content-truth certification |
| Partner offer presentation | Offers/business/code tables and presentation exist; ADR 0017 explicitly leaves transactional phases for later | Defer expansion | Define a manual pilot after core acceptance |
| Code claiming/redemption, bookings, billing | No completed public transaction flow established; schema columns do not establish delivery | Deferred | Separate scope, economics and acceptance before implementation |

## Confirmed gaps

1. **False empty listing after availability failure.** `apps/web-app/app/pages/zavedeniya/[[...path]].vue`, `toggleOpen()`, catches a failed request as `{ items: [] }`, then sets `openNow = true`. The page says there are no open venues. PR 283 fixed the analogous main-map path only. Static finding; no failure injection on production.
2. **Map sitemap and title drift.** `server/routes/sitemap-urls.get.ts` omits `/map`; production sitemap also lacks that exact URL. Live title is `Карта Калининградской области: Калининградская область | K39`; ADR 0037 specifies `Карта Калининградской области | K39`. Correct output and test it rather than changing the intended contract to conceal the gap.
3. **Duplicate map navigation.** `shared/links.ts` includes `/map` twice in `SECTION_LINKS`; `SiteFooter.vue` renders it directly with href as key. Production home HTML has one map link in the header and two in the footer.
4. **Unsupported saved-progress promise.** README and AGENTS promised browser progress. The quest page has no completion controls; app-code searches found localStorage only for persona and notice dismissal. Correct the promise; choose the desired quest behavior before building mechanics.
5. **Eat-now location failure is silent.** `EatNowPage.vue` only clears `locating` in the geolocation error callback. Unlike the main map, it explains neither denial nor timeout. Static finding pending browser permission tests.
6. **Operational claims mix defaults and implementation.** Notice expiry runs hourly, though AGENTS called its flag nightly. The old analytics paragraph waits for cabinets that already exist and calls the shared authentication session admin-only. Repository defaults cannot certify production configuration. Other periodic jobs use startup delays and intervals, not fixed calendar-night schedules.

## Agent development audit

Existing assets worth preserving: one shared `.agents/skills` directory; explicit migration/ADR registries; `check:quick`; fixture data; a guarded local editor session; standalone SSR smoke and Docker CI. Avoid building a second mechanism before measuring these.

| Friction or risk | Evidence | Next step |
| --- | --- | --- |
| Large mandatory entry context | AGENTS mixes product, complete tool list, fixture catalog, deployment and development conventions; several facts already drifted | Keep a concise invariant/command/routing entry point; move detail to verified domain guides with one source per rule |
| Platform-specific bootstrap | `.cursor/start.sh` and `scripts/env/node-path.sh` include Linux/exec-daemon assumptions and global PATH-directory links; boot check expects `/etc/profile.d/k39.sh` | Separate portable project checks from host adapters; do not rewrite a new host's global tools automatically |
| Toolchain mismatch and install policy | This host has Node 24.19.0/pnpm 11.25.0 versus pins 24.21.0/10.25.0; installation fails the active trust policy | Diagnose versions and policy before editing dependencies or running a claimed full acceptance |
| Quick check is touched-package based | `scripts/check-quick.mjs` typechecks only `@k39/types` for a types-package change; related tests may span consumers, consumer typechecks do not | Evaluate transitive consumer typechecks with a real contract change; keep full checks as the final gate |
| Full check mutates files | Root `check:full` calls `lint:fix`; CI calls read-only lint separately | Measure unexpected diff cost; propose a read-only verification command with explicit opt-in formatting |
| Finding a feature spans several entry points | Public page, API, admin, MCP, database writer and tests coexist | Add a compact task-routing map tied to real shared writers and required checks; avoid another duplicated schema description |
| Speed is not measured | No baseline timings collected in this audit | Measure fresh setup, warm start, representative `check:quick` and full gate before promising speedups |

These are focused review targets, not proof that every compatibility branch is unnecessary. Fact fallback, draft staging, unknown hours, archive semantics and local/test database guards protect real behavior. For a workaround: record the trigger, original reason, current callers, replacement and regression proof. Remove it with the affected feature, not in a broad untested cleanup.

## Documentation and verification status

README is an entry point, AGENTS sets development conventions, ADRs record decisions, review folders prove particular changes. None is a whole-product completion receipt. The previous roadmap mainly describes scoring/offers, not today's feature portfolio. `docs/facts.md`, venue guides and seven project skills still need subsystem-by-subsystem reconciliation; this pass does not certify them all.

- Inventory: 51 page files, 96 API handlers, 91 MCP definitions and 115 tracked `*.test.ts` files. File counts are not feature counts or coverage quality.
- Read-only production HTTP: 200 for home, map, routes/collections/quests, venues, cheaper/eat-now indexes, sign-in, provider listing, health, sitemap and robots, plus the relevant catalog/availability APIs. Deployment SHA was not independently verified. No authenticated or interactive browser acceptance was performed.
- [PR 283 CI](https://github.com/hmbanan666/k39/actions/runs/39831597141) passed at `d16aee64d34fc2d9e9efcc5b627fa1ef06c71727`. [Merged-main CI](https://github.com/hmbanan666/k39/actions/runs/39835313020) also completed successfully for `2ab27948cae7569f2b8273548ee4cb29027a889c`. These are upstream runs, not validation of this documentation branch.
- `node scripts/check-repo.mjs` passed on the baseline. A scan of README, AGENTS and all docs found zero broken relative Markdown links. These checks do not validate prose truth.
- Full local tests/build were not run: `pnpm install --frozen-lockfile` rejected 30 lockfile entries with `ERR_PNPM_TRUST_DOWNGRADE`. This is an installation-policy observation, not a finding that those packages are compromised. Do not disable policy or regenerate the lockfile blindly. Tool versions above differ from the pins.
- Documentation changes: repository validation, targeted Markdown ESLint, relative-link scan and `git diff --check` passed locally.
- Still unverified: authenticated publishing/ownership/moderation, mobile interaction and screenshots, restore/deployment durability, performance, all ADR contracts and comprehensive authorization boundaries.

## Definition of ready

Accept purpose and scope; exercise a representative end-to-end scenario including empty/error/unknown states; verify source and public-output consistency; pass the required checks; reconcile the documentation. Before hiding existing functionality, distinguish navigation removal, feature gates, noindex, unpublishing and deletion, and check links, direct URLs, sitemap, search, writer access and retained data.

See [roadmap](roadmap.md) for the work order. The product is not declared fully in order by this first audit.
