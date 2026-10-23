# Search failure and recovery

Task: V01's first tourist journey, F15/F23. Base: `ac3da9500118a5a5bcec60c7a7e542b331d73b60` (PR 313 merged). This is one discovered defect, outside the completed seven-item stabilization batch. No whole journey is accepted by this change.

## Trigger and correction

`poisk.vue` previously replaced absent search data with an empty result list, ignoring AsyncData status/error. An API/network failure therefore said «ничего не нашлось» and mounted analytics recorded a completed search with count zero. A retained previous response could be shown and logged against a different URL query.

The page now announces loading, explains failure and offers a retry for the same query. The ordinary GET form remains available, including without JavaScript; alternative links appear when their separate request succeeds. Only a successful response whose `query` matches the current trimmed query supplies results or analytics. Actual successful empty searches still count as zero results. Clicks use the completed search ID; pending/failure invalidates that ID. Empty copy no longer promises that best-effort analytics was saved.

Existing CSS tokens, fonts, search ranking/API, query normalization, privacy/consent rules and database schema are unchanged. Request state comes from the existing Nuxt `useFetch`; no second request/cache layer is introduced.

## Regression and browser evidence

Before the implementation, the initial six mounted/SSR cases produced four failures: recoverable error, retained results on query change, mismatched completed response and server-rendered failure. The two successful empty/blank-query cases passed. The final [eight page tests](../../../apps/web-app/test/search-page.test.ts) also cover successful retry/click attribution, actual zero-result logging once, absent alternative links and useful server-rendered results without client analytics.

[Capture script](capture.mjs) renders the exact baseline/current pages with real child components, production CSS and built fonts. Nuxt route/request state and analytics transport are isolated adapters; fixture content is visibly labelled. It asserts the baseline's false zero event and the corrected failure → pending → successful retry → genuine empty flow, completed event counts, no page errors and no horizontal overflow at both widths. This is component-browser acceptance, not a deployed Nuxt-network or production-content claim.

| Width | Before failure | After failure | Pending retry | Successful retry | Real empty result |
| --- | --- | --- | --- | --- | --- |
| 390px | [Before](before-failure-390.png) | [After](after-failure-390.png) | [Pending](after-pending-390.png) | [Recovered](after-retry-390.png) | [Empty](after-empty-390.png) |
| 1440px | [Before](before-failure-1440.png) | [After](after-failure-1440.png) | [Pending](after-pending-1440.png) | [Recovered](after-retry-1440.png) | [Empty](after-empty-1440.png) |

Reproduce from the repository root after a web build:

```bash
node docs/reviews/2026-10-23-search-failure/capture.mjs
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an installed browser. This host uses isolated Chromium 153; no browser dependency was added.

## Read-only live observations, 23 Oct

These observations initiated the first journey and are intentionally distinct from the fixtures above. No production API failure was induced, no credentials/location were supplied and no editorial write was performed. Ordinary UI searches may contribute normal anonymous search events; the synthetic no-result query is explicitly identified below.

| Real sample | Observed output | Limit |
| --- | --- | --- |
| Header search `Форт` | 20 links across routes, collections, hub, places and quest; Fort 5 opened from the results | One query/sample, not ranking quality certification |
| `/fort-5-korol-fridrih-vilgelm-iii` | Hours/cash-desk limit, ticket rows with source/check date, address and directions link; sources expanded | Output inspected, official prices/hours were not reverified; external provider route not completed |
| Synthetic query `несуществующееместоk39` | True no-result explanation and usable hub/popular-place/route links; `/forty` opened | This normal UI interaction can enter zero-result reports |
| `/forty` → `/fort-9-dona` | Hub links open a place; private/closed-access explanation, «Билетов нет», address and directions link | Closed is not unknown/stale; no claim that these separate cases passed |

Observed directions hrefs had destination coordinates `54.75262,20.44311` (Fort 5) and `54.65323,20.48449` (Fort 9), with no visitor origin. This checks link output, not the external provider's calculated path. The production viewport was not controlled; no mobile or 1440px live acceptance is inferred from these samples. Browser observations do not identify the deployed commit. Source health handler only reports database readiness, not release SHA; the available GitHub fetch surface did not expose Dokploy deployment evidence.

## Verification and remaining acceptance

Focused page/helper tests pass: 11 tests across two files. Local `check:quick` passed repository validation, selected read-only lint, web-app/writer typechecks and eight selected page tests. The browser flow passed with 10 screenshots; changed-document lint, 98 relative document links and diff checks passed. Local tools are Node 24.19.0 and pinned pnpm 12.15.0; local database/full gates are not claimed without Postgres/Docker.

[Full pre-PR CI](https://github.com/hmbanan666/k39/actions/runs/40020678330) passed on `11c7ec5577a7b9973f8e8ccda28799e77b56e9e8`: frozen install, literal `pnpm run check:full` (repository validation, read-only lint, all typechecks and 901 tests across 124 files), a clean diff after verification, production build, standalone SSR and Docker image build. CI used pinned Node 24.21.0, pnpm 12.15.0 and Postgres 18. The final follow-up only records these results and restores the original workflow; application, tests, capture script and screenshots are unchanged. Normal PR CI verifies the final head again.

After merge: verify the deployed commit, ordinary/empty search and retry behavior on the deployed Nuxt page; do not inject a production outage. Finish phone, no-JavaScript, unknown/stale and source/directions acceptance before accepting the first journey. Four further V01 journeys, six D01 scope decisions and unsized O01 recovery work remain.

PR 313's main CI [passed](https://github.com/hmbanan666/k39/actions/runs/40016964587) on the base above. Admission issue #290 remains open for all-instance migration/writer/flag verification and an authorized editorial pass. This change does not enable extra writes or modify live tickets.
