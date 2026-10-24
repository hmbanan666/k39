# Roadmap

Updated 2026-10-23. Baseline: `cf06c4f` (PR 314 merged). This is the current work queue, linked to the [25-capability inventory](product-state.md). A capability is not a task or a readiness certificate. Visibility recommendations remain proposals until accepted.

## Current position

**Current batch: 7 of 7 items merged. The separately sized admission implementation is merged in PR 313; rollout/editorial acceptance remains.** These counts cover this bounded batch, not the whole product, and are not a prediction of seven PRs. A reviewable implementation is not counted as merged or deployed. Update the counter after each merge; record newly discovered work separately instead of silently expanding the denominator.

| Completed work | Evidence | Remaining limit |
| --- | --- | --- |
| Supported dependency installation | [PR 284](https://github.com/hmbanan666/k39/pull/284) | Pinned tools and a fresh-checkout CI setup are measured in A01; local managed-host restrictions remain explicit |
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
| 5 · A01 · measure the agent loop | Merged in [PR 309](https://github.com/hmbanan666/k39/pull/309); portable preflight and optional quick timings measured; [review](reviews/2026-10-23-agent-loop/README.md) | Record host, tools, cache state, checkout-to-ready, warm start, one quick check and full gate. Demonstrate generic local setup without host-global tool rewrites. Identify a measured bottleneck before claiming faster work |
| 6 · A02 · verification commands | Merged in [PR 310](https://github.com/hmbanan666/k39/pull/310); full CI and shared-contract/formatting proofs passed; [review](reviews/2026-10-23-verification-coverage/README.md) | Assess read-only final verification with explicit formatting and typechecks for transitive consumers. Demonstrate a real shared-contract break is caught; preserve the final verification coverage |
| 7 · [#290](https://github.com/hmbanan666/k39/issues/290) · admission extras (F13) | [ADR 0050](adr/0050-admission-extras.md) merged in [PR 312](https://github.com/hmbanan666/k39/pull/312); [evidence and estimate](reviews/2026-10-23-admission-extras/README.md) | Verify official tier/add-on use cases and row-limit constraints, choose the model and record the ADR decision. Estimate implementation separately; this item does not authorize an unbounded ticketing product |

Every implementation keeps the [AGENTS verification gate](../AGENTS.md#verify-and-hand-off); UI work keeps the unchanged k39-ui screenshot requirements. After merge, verify the deployed commit and affected read-only scenario. Green CI does not establish deployment success. Investigate a workaround's original reason/callers before replacing it; fallback, staged writes and test-database guards can protect real behavior.

## Concrete follow-up after the ADR merge

Item 7 was a design decision, now merged; the current batch is 7/7. That does not resolve issue 290 or expand that denominator. ADR 0050 selects up to 48 entry rows and 12 independent paid extras, safe partial-list writes and strict separation from entry markup/scoring.

The separately sized **one implementation PR is merged as [PR 313](https://github.com/hmbanan666/k39/pull/313)** ([evidence](reviews/2026-10-23-admission-extras-implementation/README.md)), with three internal tasks: storage/shared writes/facts; UI/public/admin/scoring integration; compatibility and failure acceptance. The [ADR](adr/0050-admission-extras.md#consequences-and-delivery-boundary) gives the concrete boundaries. A separate post-deployment editorial pass needs fresh official-source checks and authorized editor writes. Cross-subject ticket sharing and deposit accounting are deferred; the merged implementation raises entry capacity to 48 and adds 12 extras. Its main-branch CI passed on `ac3da95`; that does not establish the deployed SHA, migration state or flag on every instance. Extra writes default off until every instance has the new writer. Keep issue 290 open until its agreed implementation and acceptance are complete.

V01 has resumed with the first of five tourist journeys below. The admission rollout remains a separate open acceptance item, not a blocker for read-only tourist-core work. Their defects, the six D01 decisions and the O01 recovery work still require sizing; there is no total remaining PR count yet.

## Active V01 delivery

The first journey is **in progress; 0 of 5 full journeys accepted**. On 23 Oct, read-only browser checks covered the public header search for «Форт», Fort 5's ticket/source/directions output, real zero-result recovery through `/forty`, and Fort 9's closed/private-access explanation. This is a dated sample of live output, not a fresh official-source review, mobile acceptance or deployed-commit proof.

**Search request failure and recovery (F15/F23) is merged in [PR 314](https://github.com/hmbanan666/k39/pull/314).** The existing page treated failed API requests as zero results and logged them as completed searches; retained responses could also be labelled with a new query. The [review](reviews/2026-10-23-search-failure/README.md) records isolated reproduction, error/loading/retry/empty states, analytics and SSR evidence. No production fault was injected. This is the first defect found during V01, outside the completed seven-item batch.

After the editorial issue packet below, verify PR 314 deployment and finish the first journey's phone, unknown/stale and no-JavaScript acceptance. Then assess ordered route stops/navigation, including report #307. The other four journeys have not received full acceptance. Keep admission #290 open for all-instance rollout/flag and an authorized editorial pass; no live ticket writes or rollout changes were performed here.

## Reviewed issue queue after PR 314

The owner explicitly called attention to the issue backlog after merging PR 314. All **14 open issues** were read; the [dated triage](reviews/2026-10-23-issue-triage/README.md) records reproduction, code evidence, corrected assumptions and limits for every report. None was closed just because a historic content example had been repaired by hand. This changes priority, not the completed seven-item batch denominator.

**Next bounded editorial packet: 0 of 3 merged.** Fix the save/publish blocker first, then false-positive checks that obstruct useful agent work. One scoped implementation is prepared here; the following items still need their own implementation and evidence.

| Order | Task | Completion contract |
| --- | --- | --- |
| 1 | [#295](https://github.com/hmbanan666/k39/issues/295), effective collection source list | Prepared in this change. Reject invalid inherited/sent sources before staging, identify origin, preserve existing live/pending state on failure, accept explicit repair/clear, retain canonical dedupe/cap and publish guard. Provide a read-only legacy audit; deployed acceptance remains |
| 2 | [#293](https://github.com/hmbanan666/k39/issues/293), pronoun versus superlative | Reproduced. Allow ordinary «в самом Нестерове / у самого моря» uses; preserve actual superlatives and verify FAQ/save/publish behavior |
| 3 | [#294](https://github.com/hmbanan666/k39/issues/294), appointment subject | Reproduced. A tenant/sub-attraction must not make the town appointment-only; retain own-subject contradictions. Existing internal-link sentence exclusion already works |

| Remaining group | Issues | Routing |
| --- | --- | --- |
| Source/identity/model investigations (5) | [299](https://github.com/hmbanan666/k39/issues/299), [303](https://github.com/hmbanan666/k39/issues/303), [304](https://github.com/hmbanan666/k39/issues/304), [306](https://github.com/hmbanan666/k39/issues/306), [308](https://github.com/hmbanan666/k39/issues/308) | Size phone provenance and reviewed OSM identity repair next, before a wider acceptance sweep. Current OSM re-import skips existing IDs, so automatic rollback is not established. Locality, taxonomy and social contacts need explicit model decisions/ADRs before schema work |
| Public presentation (3) | [298](https://github.com/hmbanan666/k39/issues/298), [307](https://github.com/hmbanan666/k39/issues/307), [302](https://github.com/hmbanan666/k39/issues/302) | Hidden-price feedback, honest straight-line labels and undated closure wording. A short leg is visible with valid coordinates; investigate the reported missing real leg separately |
| Guide-warning decisions (2) | [297](https://github.com/hmbanan666/k39/issues/297), [311](https://github.com/hmbanan666/k39/issues/311) | Price/count consistency and false-positive boundaries during guide/route acceptance; no automatic publish block or token-template product |
| Admission acceptance (1) | [290](https://github.com/hmbanan666/k39/issues/290) | Implementation merged; all-instance rollout, guarded enablement and authorized official-source editorial pass remain |

These groups total 14 issues: 3 + 5 + 3 + 2 + 1. They are not estimates of 14 PRs. The [triage](reviews/2026-10-23-issue-triage/README.md) explains why proposed fixes are not automatically accepted. V01 remains in progress, with 0/5 full journeys accepted; its unknown/stale/phone/no-JavaScript evidence is still required.

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
