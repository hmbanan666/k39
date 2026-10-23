# Roadmap

Updated 2026-10-23. Baseline: `73bb36e` (PR 305 merged). This is the current work queue, linked to the [25-capability inventory](product-state.md). A capability is not a task or a readiness certificate. Visibility recommendations remain proposals until accepted.

## Current position

**Current batch: 4 of 7 items merged. Item 5 is in progress in this change; item 6 is next.** These counts cover this bounded batch, not the whole product, and are not a prediction of seven PRs. A reviewable implementation is not counted as merged or deployed. Update the counter after each merge; record newly discovered work separately instead of silently expanding the denominator.

| Completed work | Evidence | Remaining limit |
| --- | --- | --- |
| Supported dependency installation | [PR 284](https://github.com/hmbanan666/k39/pull/284) | Generic hosts must resolve the pinned Node/pnpm; setup time is not yet measured |
| Small agent entry point and code/check routing | [PR 285](https://github.com/hmbanan666/k39/pull/285) | Reduced context size is measured; task speed is not |
| Portfolio and initial stabilization queue | [PR 286](https://github.com/hmbanan666/k39/pull/286) | 25 capabilities inventoried; full scenarios remain unaccepted |
| S01: venue availability failures | [PR 287](https://github.com/hmbanan666/k39/pull/287), [review](reviews/2026-10-23-venue-availability/README.md) | Merged and tested; deployed SHA/scenario acceptance pending |
| S02: map sitemap/title/footer | [PR 292](https://github.com/hmbanan666/k39/pull/292), [review](reviews/2026-10-23-map-discovery/README.md) | Merged; final XML/head/footer checks passed; deployment acceptance pending |

The working tourist core is finding a destination, understanding a visit, following a route and finding useful nearby food. Operational work must support publishing and maintaining that core. This is a working scope, not an accepted redesign or a promise to expand every existing feature.

## Next tasks

The owner reviewed this seven-item order on 23 Oct. Issue 288 goes first because it blocks repeated agent editing. New issue reports still require reproduction before their proposed fix is treated as established. No unfinished feature is hidden by this plan itself.

| Order / item | State | Completion contract |
| --- | --- | --- |
| 1 · [#288](https://github.com/hmbanan666/k39/issues/288) · pending place date (F16–F17) | Merged in [PR 296](https://github.com/hmbanan666/k39/pull/296); [review](reviews/2026-10-23-pending-place-date/README.md); deployment pending | Repeat draft saves on a checked live place; omit to preserve, null to clear, explicit replacement to change. Round-trip the real place_get timestamp. Live content stays unchanged until editor application. Regressions and full CI pass |
| 2 · S03 · eat-now location (F10) | Merged in [PR 300](https://github.com/hmbanan666/k39/pull/300); [review](reviews/2026-10-23-eat-now-location/README.md); deployment pending | Explain denied/timed-out/unavailable location in Russian, retain the usable origin/results and allow retry. Cover success, unavailable API, missing coordinates, centre/visitor distance, mobile/desktop and SSR |
| 3 · [#291](https://github.com/hmbanan666/k39/issues/291) · false closed status (F23) | Merged in [PR 301](https://github.com/hmbanan666/k39/pull/301); [review](reviews/2026-10-23-closed-status-word/README.md); stored-score/deployment acceptance pending | The footwear sentence must not flag an always-open fort as closed; real closure phrases must still be detected. Verify score/status output with regression cases |
| 4 · [#289](https://github.com/hmbanan666/k39/issues/289) · scored article length (F23) | Merged in [PR 305](https://github.com/hmbanan666/k39/pull/305); [review](reviews/2026-10-23-scored-article-length/README.md); stored-score/deployment acceptance pending | Internal-link markup must not discourage useful links. Use one agreed measure for floors, ceilings, stored bodyChars and score preview; preserve real earned-length rules |
| 5 · A01 · measure the agent loop | Measuring; portable preflight and optional quick timings implemented; [review](reviews/2026-10-23-agent-loop/README.md) | Record host, tools, cache state, checkout-to-ready, warm start, one quick check and full gate. Demonstrate generic local setup without host-global tool rewrites. Identify a measured bottleneck before claiming faster work |
| 6 · A02 · verification commands | Planned after A01 | Assess read-only final verification with explicit formatting and typechecks for transitive consumers. Demonstrate a real shared-contract break is caught; preserve the final verification coverage |
| 7 · [#290](https://github.com/hmbanan666/k39/issues/290) · admission extras (F13) | Scope/design decision | Verify official tier/add-on use cases and row-limit constraints, choose the model and record the ADR decision. Estimate implementation separately; this item does not authorize an unbounded ticketing product |

Every implementation keeps the [AGENTS verification gate](../AGENTS.md#verify-and-hand-off); UI work keeps the unchanged k39-ui screenshot requirements. After merge, verify the deployed commit and affected read-only scenario. Green CI does not establish deployment success. Investigate a workaround's original reason/callers before replacing it; fallback, staged writes and test-database guards can protect real behavior.

## Incoming reports outside the current batch

Snapshot retained after merging PR 305 on 23 Oct. Nine reports remain outside the batch; only #294 was reproduced locally during #291. They do not change the seven-item denominator or authorize their proposed fixes. Triage them before the related subsystem work; record any priority change explicitly.

| Report | Intake state / routing |
| --- | --- |
| [#293](https://github.com/hmbanan666/k39/issues/293) · pronoun forms rejected as superlatives | Unverified writing-check report; assess editorial impact |
| [#294](https://github.com/hmbanan666/k39/issues/294) · a sub-attraction makes a town appointment-only | Reproduced on isolated text: an appointment phrase about a brewery contradicts the town’s always-open mode. Separate subject-scoping issue; #291 does not fix it. Needs its own scope and regression cases |
| [#295](https://github.com/hmbanan666/k39/issues/295) · existing collections exceed the source cap and cannot publish an unrelated draft edit | Unverified publishing/compatibility report; reproduce on isolated data and assess blocking impact |
| [#297](https://github.com/hmbanan666/k39/issues/297) · copied admission prices drift in collection prose | Unverified data-consistency report; assess with practical-fact/collection acceptance |
| [#298](https://github.com/hmbanan666/k39/issues/298) · stored venue prices lack a visible prices module | Unverified reader/writer feedback report; assess with venue-price acceptance |
| [#299](https://github.com/hmbanan666/k39/issues/299) · imported phone lacks official provenance | Unverified publishing/source report; reproduce and assess impact on published contacts before prioritizing |
| [#302](https://github.com/hmbanan666/k39/issues/302) · abandoned ruins shown as temporarily closed | Unverified schedule wording/model report; distinguish lexical scoring corrections from the actual visit-status model |
| [#303](https://github.com/hmbanan666/k39/issues/303) · venue OSM identity refers to another branch | Unverified identity/provenance report; inspect import overwrite and reviewed editorial-field boundaries before choosing a change |
| [#304](https://github.com/hmbanan666/k39/issues/304) · district venues labelled as the district town | Unverified locality/grouping report; assess location model and comparison coverage together |

## Work after the current batch

| Stage | Known size | Exit |
| --- | --- | --- |
| V01 · tourist-core acceptance | Five journeys below | Representative desktop/mobile and failure/empty/unknown evidence; discovered defects get separately sized tasks |
| D01 · unfinished feature scope | Six decisions below | Accepted purpose, audience, visibility, retention and rollback for retained/hidden pilots; implementation estimated after each decision |
| O01 · editorial and recovery | Not yet split into implementation tasks | Draft → review → publish → source change/expiry → queue → correction → public output; roles/concurrency/owner conflict, media persistence, migrations, fresh jobs and demonstrated restore |

The total remaining PR count is unknown until these scenarios and decisions are assessed. Do not present these stages as three small implementation tasks or convert them into a whole-product completion percentage. After each current-batch handoff report merged count, remaining items, validation limits and why the next item is selected.

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
