# Eat-now location feedback

Task: S03 / F10, current batch item 2. Base: `29742df4a3b048c6abb47cebe9c73eccd87dca16` (PR 296 merged).

## Changes and reason

Previously, a rejected location request merely re-enabled the button. Visitors saw no explanation and could not tell whether the displayed distances were from their position or the town centre.

The page now announces location lookup, explains permission denial, timeout and unavailable location in Russian, and offers retry. It retains the last successful visitor position if refresh fails; before any success, the centre-based results remain. Unsupported browsers get an explanation without a nonfunctional button. A town without a centre does not claim centre-based distances. Missing venue coordinates remain missing.

Location is requested only after a click. The existing ten-second timeout and five-minute browser cache allowance are unchanged. Late callbacks after a town change or unmount are ignored. Server rendering retains useful venue cards without requesting location. No persistence, analytics, dependency, content or database changes are introduced.

## Regression and browser evidence

[Twelve mounted/SSR tests](../../../apps/web-app/test/eat-now-location.test.ts) cover all three browser error codes with successful retries, pending accessibility state, retention after a failed refresh, absent/incomplete APIs, synchronous failure, missing centre/coordinates, late success/failure after navigation, unmount and SSR. They render the real component with a shared isolated fixture.

The [browser capture](capture.mjs) renders the exact baseline and current components with the existing production CSS and built fonts. Fixture names are visibly labelled. Head and Nuxt routing adapters are isolated; no real permission prompt, visitor location, production data or content writes are used. Controlled browser callbacks reproduce denial, pending lookup, successful retry and failed refresh at both widths. Assertions check retained cards/distances, updated ordering on success, no page errors and no horizontal overflow.

| Width | Before denial | After denial | After successful retry |
| --- | --- | --- | --- |
| 390px | [Screenshot](before-denied-390.png) | [Screenshot](after-denied-390.png) | [Screenshot](after-success-390.png) |
| 1440px | [Screenshot](before-denied-1440.png) | [Screenshot](after-denied-1440.png) | [Screenshot](after-success-1440.png) |

Reproduce from the repository root after a web build:

```bash
pnpm exec playwright install chromium
node docs/reviews/2026-10-23-eat-now-location/capture.mjs
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing browser. This host used isolated Chromium 153 without adding a project dependency. Screenshots establish component behavior and layout, not acceptance of production permissions or the whole nearby-food journey.

## Validation and rollout

Local `check:quick` passed: repository validation, selected lint, web-app/writer typechecks and all 12 selected tests. Browser capture, changed-document lint/link checks and diff checks passed. Local tooling is Node 24.19.0 / pinned pnpm 12.15.0; full CI uses the project Node pin and Postgres 18.

[Full pre-PR CI](https://github.com/hmbanan666/k39/actions/runs/39953655837) passed on `e2623d2feaddf85d7e695e2f309cf3e104ee9c90`: frozen install, repository validation, read-only ESLint, all typechecks, 825 tests across 118 files, production build, standalone SSR and Docker image build. These are the full verification/build gates run in CI with its database and pinned runtime; the local full command was not run without Postgres/Docker. The final follow-up only records this evidence and removes the temporary branch push trigger. Final CI policy matches the base, application/test/browser-capture contents are unchanged, and normal PR CI verifies the final head again.

After merge, verify the deployed SHA and a town page on desktop/mobile: deny location, retry after permission change, obtain a position and fail a refresh. Confirm the origin label and retained cards/distances. Whole-tourist-journey acceptance remains open.

The batch is **1 of 7 merged**; this is the second item, awaiting merge. Next is issue [291](https://github.com/hmbanan666/k39/issues/291), the footwear sentence incorrectly producing a closed status. The [roadmap](../../roadmap.md) retains the remaining order and separately records incoming reports.
