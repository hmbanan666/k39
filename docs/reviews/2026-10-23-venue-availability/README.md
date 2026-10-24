# Venue availability failure and retry

Task: S01 / F09. Base: `77d69af8ef85ac258d2be3eb7fdc3bd0f0e4b880` (PR 286 merged).

## Behavior

A rejected availability request used to become `{ items: [] }`, enable the filter and falsely report no open venues. A failed or timed-out request now turns the filter off, keeps the current listing and map, announces the error and offers **Повторить**. While checking, the list/map remain visible and the filter can be switched off. Only a successful response filters the list; a successful empty response still shows the real empty state.

Requests have a 10-second timeout and no automatic retry. A request counter ignores outdated success/failure after off/on, route changes and unmount. SSR remains unfiltered and never requests live availability. API semantics, verified-schedule rules, page data and shared map behavior are unchanged.

## Regression coverage

[Mounted-page tests](../../../apps/web-app/test/venue-availability.test.ts) exercise network failure, HTTP 503 and timeout rejection, retry, map/card preservation, filtered success, successful empty response, old success/failure after off/on or cancellation, route changes, unmount and SSR. The test checks the timeout/retry options; the browser flow uses a real intercepted 503 and a held request. No real production API is fault-injected.

## Browser review

The actual listing component and its shell/cards/buttons render with production CSS and built fonts. Nuxt routing/head, icons and unused map/venue-detail integrations use the existing test adapters; API data is isolated and the fixture is visibly labelled. The screenshots cover the changed listing area, without the site header/footer. The all-region fixture has no embed; town-map input preservation is asserted in the mounted test. This is local component acceptance, not a production database, OAuth or full-site browser acceptance.

| State | 390px | 1440px |
| --- | --- | --- |
| Before: failed request falsely empties the list | [Screenshot](before-failure-390.png) | [Screenshot](before-failure-1440.png) |
| After: explanation, retry and retained cards | [Screenshot](after-failure-390.png) | [Screenshot](after-failure-1440.png) |
| After: retry pending, cards retained | [Screenshot](after-loading-390.png) | [Screenshot](after-loading-1440.png) |
| After: successful filter | [Screenshot](after-filtered-390.png) | [Screenshot](after-filtered-1440.png) |
| After: genuine zero results | [Screenshot](after-empty-390.png) | [Screenshot](after-empty-1440.png) |

No horizontal page overflow or browser page errors in the exercised flow. The mobile explanation wraps above the retry button; the desktop row keeps both visible. Brand tokens and type are unchanged.

Reproduce from repository root after installing dependencies and building the web app:

```bash
pnpm exec playwright install chromium
node docs/reviews/2026-10-23-venue-availability/capture.mjs
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing Chromium. This host used an isolated Chromium 153 executable because the Playwright CDN download failed; no browser package was added to the project. The fixture and [capture script](capture.mjs) are committed. The baseline source comes from the exact base commit above.

## Validation and rollout

Local `check:quick` passed, including web-app and writer-test typechecks plus 12 mounted regression tests. Targeted Markdown lint, documentation links and diff whitespace checks passed. Browser capture passed at both widths. [Full pre-PR CI](https://github.com/hmbanan666/k39/actions/runs/39938317856) passed on `33951a7b97c61bf846926c732a4cf23cfa32b6a6`: frozen install, repository validation, ESLint, all typechecks, 784 tests in 116 files, production build, standalone SSR smoke and Docker image build. A temporary branch push trigger enabled the run before PR creation; the final follow-up only records the evidence/adapter limits here and removes that trigger. CI policy is unchanged in the final diff, and normal PR CI checks the final head again. Local checks use the host Node 24.19.0 with pinned pnpm 12.15.0; full CI uses the repository Node pin and Postgres 18.

After merge, verify the deployed commit, list availability, successful filtering, and turning it off on a real venue listing. Production deployment has not been verified here.
