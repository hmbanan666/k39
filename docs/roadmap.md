# Roadmap

Updated 2026-10-23 from the [implementation inventory](product-state.md), baseline `5cd763c` (PR 287 merged). This is the stabilization queue for the existing product and the agent development loop. Feature IDs F01–F25 refer to that inventory. Recommendations about promotion or hiding remain proposals; this plan changes no production visibility.

## Current position

| Work | State | Evidence / remaining limit |
| --- | --- | --- |
| Supported dependency installation | Done in PR 284 | Pinned pnpm 12.15.0, trust policy retained, frozen-install CI; generic hosts must still resolve the correct Node/pnpm |
| Small agent entry point and implementation routing | Done in PR 285 | AGENTS reduced to 1,036 words, nine task rows, detailed references; task speed has not been measured |
| Feature portfolio and stabilization queue | This change | 25 capabilities, code/test starting points, known gaps and scenario gates; whole-product acceptance remains open |
| Product stabilization and acceptance | Next | S01 merged in PR 287; S02 implemented in the current change. Deployment acceptance pending; S03 next. No new feature expansion is required to fix the confirmed defects |

The proposed tourist core is finding a destination, understanding a visit, following a route and finding useful nearby food. Operational work must support publishing and maintaining that core. This is a working scope, not an accepted redesign or a promise to ship every existing capability.

## Next tasks

Task IDs identify the work across PRs; they are not GitHub issue numbers. The order is deliberate. S01–S03 are independent fixes, kept in separate PRs. A01 follows these small fixes so their agent runs can supply measurements. Scenario acceptance and operational verification may reveal additional narrowly scoped defects.

| Order / task | Trigger and implementation start | Completion contract |
| --- | --- | --- |
| 1 · S01 · venue availability errors (F07–F09), merged in PR 287; deployment pending | Reject `/api/public/availability` from the venue listing; [`toggleOpen()`](../apps/web-app/app/pages/zavedeniya/[[...path]].vue) previously substituted an empty response; [fix and evidence](reviews/2026-10-23-venue-availability/README.md) | Preserve the list on network/HTTP failure and timeout; show an accessible explanation and retry; distinguish a successful zero response. Prevent stale results after switching off or navigating. Test the mounted listing and verify 390px/1440px before/after states. The [map regression](../apps/web-app/test/map-availability.test.ts) is a reference, not coverage of this page |
| 2 · S02 · map discovery and title (F03), implemented; deployment pending | [`loadMap()`](../apps/web-app/server/utils/map/public.ts), [`sitemap-urls.get.ts`](../apps/web-app/server/routes/sitemap-urls.get.ts), [`SECTION_LINKS`](../apps/web-app/shared/links.ts); [fix and evidence](reviews/2026-10-23-map-discovery/README.md) | One footer map link; clean `/map` in the generated sitemap once; title `Карта Калининградской области | K39`. Preserve the canonical/noindex contract for query URLs. Assert actual generated output, not a duplicate constant; no shared-title change that silently affects unrelated pages |
| 3 · S03 · eat-now location feedback (F10) | Deny or time out [`EatNowPage.vue`](../apps/web-app/app/components/EatNowPage.vue) geolocation | Explain the failure in Russian, keep the current usable origin/results and allow retry. Cover success, denial, timeout, unavailable position/API and missing coordinates; distinguish centre versus visitor distance. Check mobile/desktop and SSR without location access |
| 4 · A01 · measure the agent loop | Fresh checkout and a warm task following [development](development.md); review `scripts/env/` and `.cursor/start.sh` | Record host, tool versions, cache state, checkout-to-ready, warm start, one real quick check and full gate. Demonstrate generic setup without host-global rewrites. Identify the slowest repeatable step before implementing optimization |
| 5 · V01 · tourist-core acceptance (F01–F05, F07–F15) | Exercise the five journeys below after the relevant fixes | Record environment/SHA, representative URLs or fixtures, desktop/mobile results, error/empty/unknown states and links to focused defect PRs. Separate content defects from code defects; no “ready” label from file counts or unit tests alone |
| 6 · O01 · editorial and recovery loop (F16–F19, F23) | Isolated fixtures through admin/API/MCP, plus deployment evidence | Draft → review → publish → source change/expiry → queue → correction → public output; concurrent edits, owner conflict and token matrix. Verify media persistence, migrations, job freshness and a restore. Real production credentials/configuration require their own evidence |
| 7 · D01 · unfinished scope (F06, F10–F12, F20–F25) | Review scenario results and the decisions below | Record accepted purpose, audience, visibility and acceptance criteria for each retained pilot. Implement any hiding or rework in focused PRs; do not delete data merely to reduce navigation |
| 8 · A02 · checks and workarounds | Use A01 timings and an actual shared-type contract change; inspect [quick planner](../scripts/check-quick.mjs) and `package.json` | Decide whether consumer typechecks and read-only full verification improve the measured loop. Keep final coverage; test a consumer break before changing selection. Investigate each workaround's callers and original reason before replacing it |

Every implementation task keeps the [AGENTS verification gate](../AGENTS.md#verify-and-hand-off). A UI task also keeps the unchanged `k39-ui` screenshot requirements. After merge, verify the deployed commit and the affected read-only scenario; a green PR does not establish deployment success.

## Tourist-core journeys

| Journey | Acceptance focus |
| --- | --- |
| Search or hub → place → visit facts → directions | Russian query/zero results, access/hours/price/source, unknown or stale information, real destination link |
| Place → route → ordered stops → map/navigation | Closed or archived stop, missing geometry, useful phone directions |
| Place/route → nearby food → venue → menu/status/contact | Same facts/status across surfaces, source/portion/freshness, no coordinates and thin price samples |
| Map → filters/search → selected point/route → destination | Mobile panel, deep-link/back/reset, failed availability, missing tiles/WebGL and an accessible recovery path |
| Collection/month guide → a usable outing | Classic and module guide, picker reset/share, storage disabled and SSR/hydration consistency |

Use published content for read-only acceptance and local isolated fixtures for writes. Record which real content samples were checked; do not treat a convenient fixture as a content-quality sample. Public pages must remain useful without JavaScript where their information does not depend on live location or map rendering.

## Scope decisions still open

| Direction | Starting recommendation | Decision and visibility rule needed |
| --- | --- | --- |
| Quests | Rework or reduce promotion | Editorial walk or interactive challenge? Current prose/stops are implemented; saved completion is not. Do not build progress mechanics until the job is chosen |
| Picker/personas | Pilot; defer expansion | Identify the planning task improved by remembered ordering and how it resets |
| Price comparisons / eat-now | Retain where evidence supports the promise | Choose towns/items with sufficient verified coverage; handle thin data honestly |
| Tourist cabinet / guest materials | Pilot with an accountable moderator | Define why a tourist logs in, who moderates, and how disputes/withdrawal work |
| Business claims / owner cabinet | Controlled owner pilot | Assign claim review, delivery failure, revocation and fact-conflict operations |
| Offers, redemption, billing | Defer expansion | Core acceptance and a separate partner-pilot decision first; venue ownership is not an offer redemption flow |

Hiding has several different meanings. For each decision record navigation and direct-URL behavior, sitemap/canonical/noindex, site search, public and staff writer access, existing references, and data retention. A navigation removal does not disable an endpoint. Preserve staff access when needed and define rollback; avoid premature table deletion.

ADR 0017 retains the future manual discount-code pilot, redemption accounting and business offer cabinet. Payment capture and auctions remain later work. Existing tables, partner labels and the `claim_offer` scoring action do not complete those phases.

## Keep the plan current

When a task lands, update its state and evidence here, and the affected feature row in the inventory. Reconcile the current subsystem guide and relevant skills against the verified behavior; annotate ADR implementation status only with evidence while preserving decision/supersession history. Do not mark all ADRs “implemented” because CI is green.

A feature is ready to promote when its purpose is accepted, a representative full scenario (including failure/empty/unknown states) is demonstrated, facts and public output agree, required checks pass and documentation matches. The overall cleanup is complete only when the accepted scope, editorial loop and recovery have this evidence. This initial queue is a starting baseline.
