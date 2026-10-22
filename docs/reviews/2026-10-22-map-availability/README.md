# Map availability error handling (#282)

The previous availability catch returned an empty list on request failure. Turning on the filter also hid points before the request completed, and older responses could replace the latest result.

The filter now applies only after a successful response. While loading, existing category and search results remain visible. On failure, the filter switches off and an inline alert offers a retry. Each toggle invalidates earlier requests. The request has a ten-second timeout and no automatic retry. A successful empty response still filters out all points. On phones, enabling the filter opens the sheet to its half-height snap so the loading message and retry remain visible.

## Verification

`apps/web-app/test/map-availability.test.ts` mounts the actual page and panel, stubbing only the map renderer and external services. The 12 cases cover desktop and phone modes: network and HTTP failures, retry, pending and empty results, category/search preservation, rapid off/on toggles, and older successful or failed responses.

Playwright with Chrome exercised actual fetch requests against a local Nuxt dev server at 390px and 1440px. Requests to `/api/public/availability` were intercepted as HTTP 503, a network abort, and HTTP 200 with `items: []`. The failure alert and retry were visible, the filter reverted, and the ordinary empty state appeared only for the successful empty response. The phone retry button was checked to be within the viewport.

`pnpm run check:quick` and `pnpm run check:full` passed on Node 24.21.0. The full run passed all 772 tests across 115 files, along with repository checks, lint, and all package typechecks.

## Screenshots

These viewport captures use a local database initialized by the standard app bootstrap and the OpenFreeMap fallback. JPEGs are compressed from the original PNGs. The before captures show the false empty result after HTTP 503; the after captures show the error and retained results. The final pair shows a genuine empty response.

| State | 390px | 1440px |
| --- | --- | --- |
| Before: HTTP 503 | [Phone](screenshots/before-390.jpg) | [Desktop](screenshots/before-1440.jpg) |
| After: HTTP 503 | [Phone](screenshots/after-390.jpg) | [Desktop](screenshots/after-1440.jpg) |
| After: successful empty response | [Phone](screenshots/empty-390.jpg) | [Desktop](screenshots/empty-1440.jpg) |
