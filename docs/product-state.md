# Product state

Updated: 2026-10-23. Code baseline: `9f8a8ab09cb12218073c800773ed92606ae80b90` (`main`, including PRs 283–285). Initial inspection: 2026-10-22; confirmed gaps below were rechecked on this baseline. This is the first implementation inventory and a proposed stabilization scope. It is not whole-product acceptance or a complete architecture/security audit.

## Goals and evidence

The owner reports that features were added incrementally without an overall plan or feature list. Two priorities are now explicit: bring unfinished product capabilities into order before expanding, and make agent development easier and faster. Inspect workarounds encountered along the way; remove them only after understanding their purpose and replacement.

Proposed product objective: help a visitor choose a place in Kaliningrad Oblast, understand whether and how to visit it, and plan an outing with nearby food. Validate scope decisions with the owner rather than treating this objective as an accepted redesign.

**Code** means inspected implementation, not proof of production readiness. **HTTP 22 Oct** means a read-only production request succeeded during the initial inspection; it is a dated observation, not a current content count, deployed-SHA check or browser acceptance. **Unverified** means the complete scenario was not exercised here. Recommendations are proposals; this audit changes no public route, content, account or production flag. No capability below has whole-scenario acceptance yet. Existing tests establish narrower contracts, listed separately below.

## Capability inventory

Paths beginning `app/`, `shared/`, or `server/` are under `apps/web-app/`. Counts are production endpoint snapshots, not audited business totals or content-quality measures.

| ID / capability | Implementation and evidence | Proposed disposition | Required acceptance |
| --- | --- | --- | --- |
| F01 · Place articles and six category hubs | `server/utils/public-pages.ts`, `app/pages/[slug].vue`, hub pages; SSR, sources, typed sections and facts | Core: stabilize | Real place answers access, hours, price, travel and source questions; unknown/stale facts are honest |
| F02 · Routes and directions | Ordered stops, optional stored geometry, embedded map and external directions; HTTP 22 Oct: 13 route index items | Core: stabilize | Follow a real route on a phone; check order, travel links, closed stops and absent geometry |
| F03 · Visitor and embedded maps | `packages/map`, `server/utils/map`, `app/pages/map`; HTTP 22 Oct: 266 points, 13 routes; PR 283 fixes main-map availability failures | Core: stabilize | Mobile/desktop, filter combinations, deep links, missing tiles/WebGL and error recovery |
| F04 · Collections and month guides | `app/pages/podborki`, `shared/page-modules.ts`; classic and module layouts; HTTP 22 Oct: 23 collection items, 12 month entries | Keep useful guides; assess presentation complexity | One classic and one module guide must support a concrete trip-planning task |
| F05 · Picker and remembered persona | `usePagePicker`, `useVisitorPersona`; URL answers and localStorage hints after hydration | Pilot; defer expansion | Understand/reset ordering, share a link, disable storage, verify SSR/hydration |
| F06 · Quests | Quest page shows prose, route, map and stop cards; HTTP 22 Oct: one quest; no completion controls or saved progress found | Rework or reduce promotion | Choose an editorial walk versus an interactive challenge and define success |
| F07 · Venue catalog and pages | `server/utils/venues/public.ts`, `VenuePage`, catch-all listing; HTTP 22 Oct: 151 listing items | Supporting core: stabilize a representative set | Place -> nearby food -> venue -> reliable contact/directions |
| F08 · Schedules and availability | Rules, intervals, exceptions and unknown states in `shared/schedule`, `server/utils/schedule.ts`, availability API | Core data dependency: retain | Same venue status across page, cards, map and lists at time boundaries |
| F09 · Venue listing open-now filter | Listing `toggleOpen()` still catches failed availability as an empty list, separately from PR 283 | Fix | Failure preserves results and shows retry; successful empty result remains distinct |
| F10 · Eat-now hub and proximity | `EatNowPage`, `loadEatNow`; browser groups statuses after hydration; HTTP 22 Oct: 13 towns | Pilot; improve feedback | Unknown/closed schedules, denied/timed-out location, no coordinates and no-JS |
| F11 · Menu price anchors and bands | `comparable-prices.ts`, `menu-prices.ts`, `shared/price-compare.ts`; official comparison sample separated from owner prices | Keep where evidence exists | Trace item, portion, price, source and freshness across surfaces |
| F12 · Where-cheaper and item price pages | `server/utils/venues/price-page.ts`; HTTP 22 Oct: three city entries; fresh-sample thresholds | Pilot with explicit coverage | Thin/missing samples, stale prices, portions, closed venues and crawl thresholds |
| F13 · Ticket prices and dated events | `server/utils/practical`, `TicketsFact`, `UpcomingEvents`; source-backed rows and expiry paths | Retain practical facts; defer event-product expansion | Expired/cancelled entries, audiences, prices and JSON-LD agree |
| F14 · Temporary closures and relocations | `server/utils/notices`, `TemporaryNotices`, `shared/notices.ts`; notices affect availability without moving stored coordinates | Retain; verify cross-surface behavior | Future/current/expired closure and relocation on page, cards, map and API |
| F15 · Site search | Search API, database repository, `/poisk`, reporting | Core: stabilize | Russian forms, typo/transliteration, zero results, draft/archive exclusion and navigation |
| F16 · Admin editing and draft review | `server/utils/content/save.ts`, admin draft endpoints, `content_drafts`; several writer tests exist; signed-in flow unverified | Operational core: retain | Draft, compare, concurrent edit, apply, discard and archive per entity |
| F17 · Content MCP and token boundaries | 91 tool definition files, strict wrapper, editor/draft capabilities; no production writes here | Operational core: retain | Editor/draft/absent-token matrix on fixtures; live-write staging/refusal and audits |
| F18 · Facts, verification queue and source watcher | `server/utils/facts`, refs, revisions and queue; public phase-2 projection exists for selected kinds | Retain; assess complexity through the workflow | Source change/failure, TTL, gap, column fallback and owner conflict through to public output |
| F19 · Media processing and storage | Ingestion utilities, sharp variants and attachment relations; upload and volume durability unverified | Operational core: retain | License/source, failed ingest, references on deletion and redeploy persistence |
| F20 · OAuth and personal cabinet | HTTP 22 Oct: provider endpoint listed Yandex and VK; profile, venue membership and guest rows exist; no login attempted | Pilot; require a tourist-account use case | Login/logout, consent, redirects, expiry, roles and meaningful empty state |
| F21 · Venue claims and owner editing | Code/manual claims, membership and revisions; delivery depends on transports; production delivery unverified | Controlled business pilot | Claim -> approve -> restricted edit -> review/conflict -> revoke; expiry and delivery failure |
| F22 · Guest reviews, tips, photos and corrections | Guest form/block, moderation and cabinet rows; not the removed legacy social system | Pilot with a moderation owner | Submit, approve/reject, withdraw, photo rules and correction-to-queue flow |
| F23 · Analytics, scores and editorial personas | Separate collect/search paths, passports, jobs, coverage and reports; `useTrack` defaults off | Internal tools: retain and validate usefulness | Report/funnel accuracy, job freshness and decisions supported; score is not content-truth certification |
| F24 · Partner offer presentation | Offers/business/code tables and presentation exist; ADR 0017 explicitly leaves transactional phases for later | Defer expansion | Define a manual pilot after core acceptance |
| F25 · Code claiming/redemption, bookings, billing | No completed public transaction flow established; schema columns do not establish delivery | Deferred | Separate scope, economics and acceptance before implementation |

## Confirmed gaps

These are reproducible static findings on the current baseline. They were not fault-injected on production. The task IDs and completion criteria are in the [roadmap](roadmap.md#next-tasks).

| Finding | Evidence and trigger | Next task |
| --- | --- | --- |
| Failed availability request becomes “no open venues” | [`toggleOpen()`](../apps/web-app/app/pages/zavedeniya/[[...path]].vue) catches a rejected fetch as `{ items: [] }`, then enables the filter. The same empty array also represents a successful response. PR 283 fixed the visitor map, not this listing. | S01 |
| Map missing from sitemap and repeated region in title | [`sitemap-urls.get.ts`](../apps/web-app/server/routes/sitemap-urls.get.ts) has no map entry. [`loadMap()`](../apps/web-app/server/utils/map/public.ts) calls `collectionDocument` without a `seoTitle`; that helper appends the region to the already region-specific H1. [ADR 0037](adr/0037-visitor-map.md) specifies `Карта Калининградской области | K39`. | S02 |
| Duplicate map footer entry | [`SECTION_LINKS`](../apps/web-app/shared/links.ts) contains `/map` twice; [`SiteFooter.vue`](../apps/web-app/app/components/SiteFooter.vue) iterates it with href as key. | S02 |
| Eat-now geolocation error is silent | [`EatNowPage.vue`](../apps/web-app/app/components/EatNowPage.vue), `locate()`, only clears `locating` on rejection. The centre-based results remain, but the visitor gets no denial/timeout explanation. | S03 |

Two documentation defects are already corrected by [PR 285](https://github.com/hmbanan666/k39/pull/285): saved quest progress was promised without implementation; operational paragraphs misreported notice-expiry timing and the shared auth session. Do not reopen these as unfinished code work. The quest product decision remains open (D01); the correction did not add progress mechanics.

## Existing tests and their limits

All paths in this table are repository-relative. A listed test is a starting point, not evidence that every acceptance criterion above is covered. Test-file existence and a green suite do not establish production readiness.

| Features | Existing contract / starting tests | What still needs scenario acceptance |
| --- | --- | --- |
| F01–F02 · places and routes | [place rendering](../apps/web-app/test/place-page.test.ts), [route navigation](../apps/web-app/test/route-nav.test.ts), [ordered stops](../packages/database/src/repository/test/stops.test.ts) | Real visit information, stop availability and phone directions |
| F03 · map | [filter/query helpers](../apps/web-app/test/map.test.ts), [availability failures and races](../apps/web-app/test/map-availability.test.ts), [scene core](../packages/map/test/layers.test.ts) | Browser interaction, missing basemap/WebGL, mobile panel and combined filters |
| F04–F06 · guides, picker, quests | [modules](../apps/web-app/test/page-modules.test.ts), [month ordering](../apps/web-app/test/month-guide.test.ts), [persona values](../apps/web-app/test/visitor-persona.test.ts), [quest cards](../apps/web-app/test/quest-page.test.ts) | Shared URLs/reset/storage-off; coherent editorial quest. Quest tests do not implement saved progress |
| F07–F10 · venues and eat-now | [venue public helpers](../apps/web-app/test/venues.test.ts), [schedule cases](../apps/web-app/test/schedule.test.ts), [status consistency](../apps/web-app/test/status-consistency.test.ts), [eat-now grouping/distance](../apps/web-app/test/eat-now.test.ts) | Listing request failure/retry, geolocation rejection and a full nearby-food journey |
| F11–F12 · menu and comparison prices | [price comparison](../apps/web-app/test/price-compare.test.ts), [price repository](../packages/database/src/repository/test/prices.test.ts) | Source/portion/freshness across surfaces and sufficient real city/item coverage |
| F13–F14 · tickets, events, notices | [practical rendering](../apps/web-app/test/practical.test.ts), [notice windows/rendering](../apps/web-app/test/notices.test.ts), [notice writers](../packages/database/src/repository/test/notices.writer.test.ts) | Cancelled/expired/current states across pages, maps, cards and structured data |
| F15 · search | [query helpers](../apps/web-app/test/search.test.ts), [repository matching/visibility](../packages/database/src/repository/test/search.test.ts) | Real Russian queries, zero-result recovery and a useful destination |
| F16–F18 · publishing, MCP, facts | [save entry](../apps/web-app/test/content-save.test.ts), [pending publish](../packages/database/src/repository/test/pending-publish.writer.test.ts), [MCP input registration](../apps/web-app/test/mcp-strict-input.test.ts), [facts](../apps/web-app/test/facts.test.ts) | Real editor/draft/anonymous matrix, concurrent edits and source-change-to-public correction |
| F19 · media | [pipeline](../apps/web-app/test/media-pipeline.test.ts), [ingest writer](../packages/database/src/repository/test/media-ingest.writer.test.ts) | Failure cleanup, deletion references and volume persistence/restore |
| F20–F22 · accounts, claims, guest submissions | [guard](../apps/web-app/test/auth.test.ts), [cabinet helpers/rendering](../apps/web-app/test/cabinet.test.ts), [claim repository](../packages/database/src/repository/test/claims.test.ts), [guest lifecycle](../packages/database/src/repository/test/guests.test.ts), [moderation scopes](../apps/web-app/test/guest-mcp.test.ts) | Provider redirects/session expiry, delivery failure/revocation and an accountable moderator |
| F23 · measurement | [analytics](../apps/web-app/test/analytics.test.ts), [scoring](../apps/web-app/test/scoring.test.ts), [persona coverage](../apps/web-app/test/persona-coverage.test.ts) | Fresh jobs, accurate funnels and a real editorial decision supported by reports |
| F24–F25 · commercial funnel | [ADR 0017](adr/0017-geo-offers.md) explicitly separates presentation from future transaction phases | No completed claim/redemption/billing flow established; do not infer delivery from schema |

## Agent development audit

Existing assets worth preserving: one shared `.agents/skills` directory; explicit migration/ADR registries; `check:quick`; fixture data; a guarded local editor session; standalone SSR smoke and Docker CI. Avoid building a second mechanism before measuring these.

| Friction or risk | Evidence | Next step |
| --- | --- | --- |
| Large mandatory entry context | PR 285 reduced AGENTS from 5,161 to 1,036 words and added a nine-row code/check map | Done; validate discoverability during real tasks. Detailed guides remain references, not certified product truth |
| Platform-specific bootstrap | `.cursor/start.sh` and `scripts/env/node-path.sh` include Linux/exec-daemon assumptions; boot check expects `/etc/profile.d/k39.sh` | A01: measure generic setup, then separate portable diagnostics from host adapters |
| Toolchain mismatch and install policy | PR 284 pins pnpm 12.15.0, preserves trust policy and passes frozen-install CI | Migration done; verify the shell resolves project tools. The generic audit host still has Node 24.19.0 rather than the 24.21.0 pin; full checks use CI |
| Quick check is touched-package based | A types-only change selects only `@k39/types`; consumers may still fail compilation | A02: exercise an actual shared-contract failure before changing selection |
| Full check mutates files | `check:full` calls `lint:fix`; CI uses read-only lint | A02: assess a read-only final check with formatting explicit; preserve coverage |
| Speed is not measured | No fresh-setup/warm-start/full-gate timing baseline collected | A01: record tool versions, host, cache state and timings before claiming faster task completion |

These are focused review targets, not proof that every compatibility branch is unnecessary. Fact fallback, draft staging, unknown hours, archive semantics and local/test database guards protect real behavior. For a workaround: record the trigger, original reason, current callers, replacement and regression proof. Remove it with the affected feature, not in a broad untested cleanup.

## Documentation and verification status

README is an entry point, AGENTS sets development conventions, ADRs record decisions, and review folders establish particular changes. None is a whole-product completion receipt. The former roadmap described scoring/offers rather than the current portfolio; [the current roadmap](roadmap.md) replaces it with stabilization and acceptance tasks while preserving future business design in ADR 0017. `docs/facts.md`, venue guides and the seven skills still need reconciliation during their subsystem tasks; this inventory does not certify them all.

- Baseline inventory: 51 page files, 96 API handlers, 91 MCP definitions and 115 tracked `*.test.ts` files. File counts are not feature counts or coverage-quality measures.
- Historical read-only HTTP (22 Oct): home, map, routes/collections/quests, venues, cheaper/eat-now indexes, sign-in, providers, health, sitemap/robots and relevant public APIs returned 200. Deployment SHA was not verified; no authenticated or interactive acceptance was performed. These observations are not re-labelled as current checks.
- PRs 284 and 285 resolved installation policy compatibility and reorganized agent instructions. [Agent-entry-point CI](https://github.com/hmbanan666/k39/actions/runs/39845583530) passed 772 tests, typechecks, build, standalone SSR and Docker on `1f215e4eecf5355985f97cc14448ae5a2cf73f1a`. That is prior change evidence, not a fresh run for this inventory.
- Current-branch checks and exact tested SHA are recorded in [this review](reviews/2026-10-23-product-baseline/README.md). This audit uses local source inspection; it does not log into production or change content/configuration.
- Still unverified: authenticated publishing/ownership/moderation, mobile interaction/screenshots, restore/deployment durability, performance, all ADR contracts and comprehensive authorization boundaries.

## Definition of ready

Accept purpose and scope; exercise a representative end-to-end scenario including empty/error/unknown states; verify source and public-output consistency; pass the required checks; reconcile the documentation. Before hiding existing functionality, distinguish navigation removal, feature gates, noindex, unpublishing and deletion, and check links, direct URLs, sitemap, search, writer access and retained data.

See [roadmap](roadmap.md) for the work order. The product is not declared fully in order by this first audit.
