# Open issue triage, 22 October 2026

The review started with 13 open issues. Eight have actionable repository changes. Five design proposals are declined; the concrete button target defect from #264 is included in the fixes.

| Issue | Decision and evidence |
| --- | --- |
| #218 | Keep the existing boot self-check, URL-dispatching test stub, Docker prepare dependency, and symlink regression checks. Fix the remaining local media default, document `NUXT_DEVTOOLS=0` and `--no-tui`, and make commit-message cleanup portable to macOS. A personal Cursor dashboard override is an owner-side setting; the repository cannot select it. |
| #246 | All 91 tool definitions use `defineStrictMcpTool`. The protocol test registers the actual definitions through the installed toolkit, checks `additionalProperties: false`, and rejects an unknown argument before a handler can run. |
| #249 | The original schedule refusal and schedule-based score were already on main. Implement the remaining accepted ADR 0047: stage venue fields, opening schedules, and prices; apply atomically; keep newer owner keys pending; show and decide the draft in admin; preview its score. Archived venues refuse draft-token writes. |
| #262 | Define missing tokens, move component colors and shadows into tokens without changing their light values, consolidate the fixed paper-map colors, and correct the docs. Enforce defined color references and the documented AA text pairs in tests. |
| #263 | Fix the declared-but-unavailable font weights with variable ranges. Retain the established type scale and preload policy. Larger heroes and other typographic restyling have no demonstrated defect and are excluded. |
| #264 | Fix the concrete standard-button target size to 44px. Decline a wholesale radius/card/button/header redesign: it changes the approved visual direction without a demonstrated visitor problem. |
| #265 | Decline mass scroll reveals and view transitions. Their absence is not a functional defect, and the design skill recommends selective motion. |
| #266 | Decline a new photo/bento home direction without a product problem and the required accepted ADR. Existing map, route, and search navigation remains available. |
| #267 | Decline a full-bleed photo hero and overlapping controls without a demonstrated reading or navigation problem. |
| #268 | Decline enabling dark mode as bug fixing: ADR 0010 explicitly leaves dark tokens prepared and inactive. |
| #271 | Cap all h3 cached-body sources and streams, preserve parser interoperability, cap authenticated MCP POSTs, charge upload quota after the body cap, use the shared Russian JSON error, and test real bytes exactly at the upload limit. |
| #273 | Render schedule text for every mode in server HTML, including unverified schedules. A full page does not repeat its static appointment/always/closed row after live status hydrates. |
| #274 | Share the official URL classifier, correct the phone-source hint, and add the read-only website/fact URL report. The place phone and pending row already share a transaction on main; do not redo that fix. Existing facts are not silently relabeled. |

## Validation

Node 24.21.0, pinned pnpm 10.25.0, and an isolated local Postgres 18 cluster. The final branch is rebased on #280.

- `pnpm run check:full`: repository and skill checks, ESLint, all package and writer-test typechecks, 759 tests in 114 files.
- `pnpm --filter @k39/web-app build`: successful Nuxt/Nitro production build.
- Browser checks at 390px and 1440px: eight public screens below, no horizontal overflow. All five standard button variants measure at least 44px high.
- Actual local editor session: venue live/draft diff includes fields, hours and prices; save presents the pending-draft choice; apply succeeds; discard preserves the live row; appointment text remains visible with JavaScript disabled. No browser page errors in that flow.
- Integration tests cover partial and total owner conflicts, restaging one key without refreshing others, explicit clears, omitted keys, stale apply/discard stamps, concurrent staging, stop-list refusal, and rollback when a later ledger write fails. A notices-only control cannot approve unseen venue fields.

## Font and performance measurements

The generated CSS declares Alegreya `400 800` in normal and italic, Golos Text `400 700`, and Alegreya SC `400`. The existing preload policy is retained.

| Measurement | Before | After |
| --- | ---: | ---: |
| Generated WOFF2 files | 8 | 8 |
| Generated WOFF2 bytes | 255,472 | 227,212 |
| Lighthouse performance | 74 | 78 |
| LCP, milliseconds | 5,058 | 4,316 |
| CLS | 0.000926 | 0.002426 |

These are one local mobile Lighthouse 12.8.2 run per production build on the same machine and fixture database, not production field data. CLS increased slightly and remains below 0.01; it is not zero. The font payload shrank by 28,260 bytes. No larger hero or body-size change is included.

## Screenshots

The linked JPEGs are compact viewport crops of the full Playwright captures. The fixture database has synthetic noindex content. The map uses the paper fallback; no production basemap download was part of this run.

| Screen | Before 390px | After 390px | Before 1440px | After 1440px |
| --- | --- | --- | --- | --- |
| Home | [Before](screenshots/before-home-390.jpg) | [After](screenshots/after-home-390.jpg) | [Before](screenshots/before-home-1440.jpg) | [After](screenshots/after-home-1440.jpg) |
| Place contacts | [Before](screenshots/before-fixture-contact-390.jpg) | [After](screenshots/after-fixture-contact-390.jpg) | [Before](screenshots/before-fixture-contact-1440.jpg) | [After](screenshots/after-fixture-contact-1440.jpg) |
| Tickets and events | [Before](screenshots/before-fixture-museum-390.jpg) | [After](screenshots/after-fixture-museum-390.jpg) | [Before](screenshots/before-fixture-museum-1440.jpg) | [After](screenshots/after-fixture-museum-1440.jpg) |
| Venue | [Before](screenshots/before-zavedeniya-fixture-cafe-photo-390.jpg) | [After](screenshots/after-zavedeniya-fixture-cafe-photo-390.jpg) | [Before](screenshots/before-zavedeniya-fixture-cafe-photo-1440.jpg) | [After](screenshots/after-zavedeniya-fixture-cafe-photo-1440.jpg) |
| Route | [Before](screenshots/before-marshruty-fixture-route-390.jpg) | [After](screenshots/after-marshruty-fixture-route-390.jpg) | [Before](screenshots/before-marshruty-fixture-route-1440.jpg) | [After](screenshots/after-marshruty-fixture-route-1440.jpg) |
| Modules | [Before](screenshots/before-podborki-fixture-modules-390.jpg) | [After](screenshots/after-podborki-fixture-modules-390.jpg) | [Before](screenshots/before-podborki-fixture-modules-1440.jpg) | [After](screenshots/after-podborki-fixture-modules-1440.jpg) |
| Town venues | [Before](screenshots/before-zavedeniya-fixture-town-390.jpg) | [After](screenshots/after-zavedeniya-fixture-town-390.jpg) | [Before](screenshots/before-zavedeniya-fixture-town-1440.jpg) | [After](screenshots/after-zavedeniya-fixture-town-1440.jpg) |
| Visitor map | [Before](screenshots/before-map-390.jpg) | [After](screenshots/after-map-390.jpg) | [Before](screenshots/before-map-1440.jpg) | [After](screenshots/after-map-1440.jpg) |

The new venue review flow has no previous counterpart: [390px](screenshots/after-venue-pending-390.jpg), [1440px](screenshots/after-venue-pending-1440.jpg). Both the live and proposed values appear in the same notice. The public appointment mode with JavaScript disabled is [shown here](screenshots/after-appointment-nojs-390.jpg).
