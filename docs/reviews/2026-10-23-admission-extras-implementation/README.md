# Admission extras implementation

Date: 2026-10-23. Baseline: `2a332295f9f4f918616ac89cde343fb2e3745e33` (PR 312 merged). Implements [ADR 0050](../../adr/0050-admission-extras.md) for [issue 290](https://github.com/hmbanan666/k39/issues/290). The seven-item batch is 7/7 merged; this is its separately sized implementation follow-up. Merge, deployment, enabling extra writes and live editorial acceptance are distinct states.

## Change

Migration 0046 adds entry/extra kinds and service units to the existing admission table. Existing rows remain entry with their amount/source/check dates unchanged; entry fact values and hashes are untouched. Entry capacity is 48 and extra capacity 12. The shared writer validates both supplied lists, locks one subject and commits rows, facts, source tracking and retirement in one transaction. Omitted lists are untouched; `[]` clears only that list. Legacy entry-array/internal and rows-only/MCP/admin saves preserve extras. A fact/source failure rolls the write back; the caller sees an error and can retry. Owner-controlled facts are preserved or refused rather than silently replaced/retired.

MCP/admin reads partition lists and stale counters; extras-only subjects remain discoverable. Fact updates check the slot namespace and value variant. Hash confirmation now advances the matching row's display date in the same transaction without a value/hash/revision change; wrong hashes change neither date. Entry-only SQL scoring, fallback, offers and free-access inference prevent a service price from becoming admission evidence. Public SSR uses the same place/venue/route helper; each fresh row shows provenance and a check date, and extras show source-stated units/conditions. Wholly stale groups have separate unknown messages. The editor saves each list separately and preserves unsaved inputs in the other form.

## Rollout boundary

`FEATURE_ADMISSION_EXTRAS_WRITE` defaults false: deploy the new writer to **every running instance** before enabling it. Disabled extra list/value writes return 503 before either list changes; entry writes and all reads continue. Draft-token live-parent writes still return 409 with no pending payload. Hash-only freshness confirmation keeps its existing permissions. Enabling does not grant new roles. See [rollout/rollback](../../development.md#admission-extras-rollout).

Disabling writes preserves stored public data. An old whole-list writer is unsafe over new extras; prefer a forward repair, or stop/guard all writes independently before an older-image rollback. Do not drop stored extras/facts. No production price was read or written for this implementation. No seed, label-based migration, cross-page ticket catalog, deposit accounting or booking/payment is included. Keep issue 290 open through deployment and agreed live acceptance.

## Browser evidence

The [capture script](capture.mjs) loads the actual baseline/current public and admin components, existing production CSS and built fonts. Data and request responses are visibly labelled synthetic fixtures; Nuxt requests, routing and icons use isolated test adapters. No production database, login session, real tariff or content write is used. This is component browser acceptance, not full-site/auth/deployment acceptance.

At both widths it asserts separate groups and units, wholly stale fallbacks, extras-only unknown entry, no horizontal overflow and no page errors. The admin flow edits an extra, saves entry tickets and retains the unsaved extra; a failed extra save announces the error and retains inputs; a successful retry sends only extras. Screenshots show the changed blocks; header/footer are outside the fixture.

| Surface/state | 390px | 1440px |
| --- | --- | --- |
| Public before | [Image](before-public-390.png) | [Image](before-public-1440.png) |
| Public after | [Image](after-public-390.png) | [Image](after-public-1440.png) |
| All stale after | [Image](after-stale-390.png) | [Image](after-stale-1440.png) |
| Editor before | [Image](before-admin-390.png) | [Image](before-admin-1440.png) |
| Editor after | [Image](after-admin-390.png) | [Image](after-admin-1440.png) |
| Failed extra save, inputs retained | [Image](after-error-390.png) | [Image](after-error-1440.png) |

Run after a web build with `node docs/reviews/2026-10-23-admission-extras-implementation/capture.mjs`. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an installed browser. This managed host used the existing isolated Chromium 153; no dependency was added. The before sources and constants come from the exact baseline above.

## Verification

Local focused component/contract regressions passed: 39 tests in three files, covering payload separation, explicit clears, rollout-disabled controls, failed saves, SSR provenance/prerequisites/units, old fact hashes, mixed/unknown shapes, capacities and JSON-LD isolation. Browser capture passed at 390px and 1440px and the screenshots were visually inspected. Local Node is 24.19.0 rather than pinned 24.21.0; pnpm is pinned 12.15.0. The local host has no Postgres/Docker, so database and full verification use CI.

Database regressions add legacy migration preservation, 48/49 and 12/13 boundaries, omission/clears, validation before mutation, same-name slot namespaces, fact update/retirement/confirmation, draft/live and rollout refusal, transactional failure/retry, concurrent saves and the actual SQL scoring aggregate. Local targeted lint and database/web/writer typechecks passed after corrections during implementation. A whole local quick/full pass is not claimed: the iterate command was used while changing types, and its related database tests require the unavailable local Postgres/Docker. [Full pre-PR CI](https://github.com/hmbanan666/k39/actions/runs/39999643511) passed on `838ea7d24ee8b455aad20430dd29b1aa3a47f353`: literal `pnpm run check:full`, all package typechecks, **893 tests in 123 files**, web build, standalone SSR and Docker. `git diff --exit-code` passed after the full command. CI used Node 24.21.0, pnpm 12.15.0 and Postgres 18. All new database cases above ran against the migrated test database.

The final follow-up only records evidence/rollout wording, updates three desktop screenshots from the successful repeat of the same capture flow, and removes temporary branch-push/full-command validation scaffolding. Application, migration, skill, test and capture source content is unchanged from the tested commit. The final workflow exactly matches the baseline; normal PR CI runs against the final head again. Relative documentation links and final Markdown lint passed.

## Remaining acceptance

After merge, verify the deployed SHA and migration on every instance, enable extra writes, then re-read official prices/effective dates and use authorized editor writes for representative place/venue/route output. Check source ownership, units, entry prerequisites, fresh/stale/unknown behavior, JSON-LD and refreshed stored scores. The [design-source review](../2026-10-23-admission-extras/README.md) records contradictory/partially unavailable official pages; fixtures do not resolve those prices. Five V01 journeys, six D01 scope decisions and O01 recovery/editorial work remain separately visible in the [roadmap](../../roadmap.md).
