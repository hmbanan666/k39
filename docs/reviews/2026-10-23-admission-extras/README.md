# Admission extras: design-source evidence

Date: 2026-10-23. Baseline: `cac4720f1e2e89869ae2bce6f080c710514eb51c` (PR 310 merged). Design: [ADR 0050](../../adr/0050-admission-extras.md). Issue: [290](https://github.com/hmbanan666/k39/issues/290). This is a design review, not a price import, stored-content audit or implementation acceptance.

The implementation findings below describe this baseline, before [PR 313](https://github.com/hmbanan666/k39/pull/313). See the [implementation review](../2026-10-23-admission-extras-implementation/README.md) and [current contract](../../content-system.md#admission-entry-and-extra-lists) for the delivered behavior.

## Inspected implementation at the baseline

| Path | Finding |
| --- | --- |
| [Shared admission model](../../../apps/web-app/shared/admission.ts) | Five audiences, 12-row constant; all fresh rows emit `Offer`s; any stored row suppresses the legacy summary; any fresh general row makes free-access inference false |
| [Shared writer](../../../apps/web-app/server/utils/practical/admission.ts) | Schema and normalization enforce the cap and audience rules; omitted slots retire facts; draft/live-parent guard is shared; database row replacement precedes fact commits |
| [Storage/repository](../../../packages/database/src/repository/practical.ts), [schema](../../../packages/database/src/tables.ts) | One subject-owned list; replacement deletes that entire subject list inside its row transaction; uniqueness is subject plus slot |
| [MCP set](../../../apps/web-app/server/mcp/tools/admission-set.ts), [fact update](../../../apps/web-app/server/utils/mcp/fact-write.ts) | `rows` is required; entry value shape is assumed by fact updates. Old clients need a preservation rule when extras arrive |
| [Public component](../../../apps/web-app/app/components/TicketsFact.vue), [admin](../../../apps/web-app/app/components/admin/PracticalEditor.vue), [scoring aggregate](../../../packages/database/src/repository/scoring.ts) | Public table, editor capacity and SQL counts all need the partition; a schema-only or JSON-LD-only change would be incomplete |

The existing writer regression explicitly rejects 13 rows ([test](../../../packages/database/src/repository/test/practical.writer.test.ts)). This review did not run its database suite locally: the managed host has no local Postgres/Docker.

An isolated, read-only call to current shared helpers used a synthetic `general` row labelled as an audio guide. It returned `stored: true`, an `Offer` for that label and `admissionFree: false`. Thus using a label as a workaround changes entry semantics. This was an in-memory example only; no database or production page was written. The helper call used host Node 24.19.0, below the repository's 24.21.0 pin. The helper probe does not validate the server writer.

## Official-source sample

Read on 23 Oct through public official pages. Facts below justify the model; they are not committed page content, a complete tariff list or authority to update production. Re-read the applicable source before any later editor save.

| Official source | Observed structure / design implication | Limit |
| --- | --- | --- |
| [Art museum tariff](https://kaliningradartmuseum.ru/about/prices/) | Page headed effective 1 Sep 2026. Six main-building entry products each have five ordinary audience cells, including free preschool entry; a family product adds another row. Audio guides and tours are listed separately. Some tours are per person and one is a flat individual-service amount. The ordinary entry matrix alone exceeds 12 rows | Counts are source cells, not audited stored K39 rows. Pushkin-card variants and conditional free categories can add further distinctions. A raised cap is still finite |
| [Friedland Gate price page](https://fvmuseum.ru/stoimost-poseshcheniya/) | Separate entry products, group excursion service, audio-guide rental, other paid activities and a refundable device deposit. Free/reduced entry does not automatically include services | A deposit must not become a service amount. Exact inclusions and effective dates need checking when writing; this HTML sample does not establish the report's stored count of 11 |
| [Dönhoff FAQ](https://fortdonhoff.ru/faq), [services](https://fortdonhoff.ru/nashi-uslugi/) | Entry and a separate excursion fee; planetarium and science-museum activities have per-person amounts and require a fort entry ticket. The service page also advertises activities at another fort | Subject ownership and prerequisites must be explicit. These pages repeat conflicting older entry amounts elsewhere; this review does not resolve or publish those prices |
| [Historical/art museum tariff landing page](https://koihm.ru/stoimost-poseshheniya/prejskurant/) | Explicit group tour charge plus entry per visitor; services and entry concessions are distinguished | Its current tariff link serves a DOCX that the web reader could not parse. The report's current combined-ticket inventory and amounts were not independently verified. A 2024 indexed PDF exists but is not current-price evidence |
| [Amber museum price page](https://www.ambermuseum.ru/for_visitors/prices/) | Official search indexing mentions an audio guide | Direct retrieval timed out (www) or returned 403 (bare host). Roof-deck/tour details and current prices from the report remain unverified; they do not determine the capacity choice |

The art-museum matrix can be represented by 31 ordinary audience cells including the family product; grouping equal school/pensioner prices with a shared condition still leaves 25 rows. That arithmetic demonstrates a real capacity issue without claiming all 31 rows are mandatory for K39. Forty-eight entry rows and twelve independent extras are the selected editorial bounds, not a claim to encode every museum's commercial catalog.

## Chosen contract and scope

ADR 0050 uses separate entry/extra lists backed by the existing admission primitive, with explicit omitted-list preservation. It keeps old entry fact values/hashes intact and gives extras a separate slot namespace. Extras have their own public group, source/check lifecycle and optional source-stated unit; they cannot set entry offers, fallback, free-access inference or admission-based scoring.

The larger entry cap is the chosen response to the combined-ticket/capacity part of issue 290. Cross-subject price sharing is deferred explicitly, with the maintenance cost of per-subject rows recorded. No deduplication or collection-price-drift fix is claimed. Deposits, ranges and booking/payment are outside this increment.

## Validation of this documentation change

`check:quick` passed locally: repository checks and lint on six changed Markdown files; no package typecheck or test was selected for this documentation-only diff. Relative documentation targets were checked separately. [CI run 39992880195](https://github.com/hmbanan666/k39/actions/runs/39992880195) passed on `a8661b12cee3299be52c8a10743fc11ff17d07dd`: literal `pnpm run check:full`, 872 tests in 121 files, all package typechecks, web build, standalone SSR and Docker. `git diff --exit-code` passed after the full check. Tools were pinned Node 24.21.0 and pnpm 12.15.0, with Postgres 18 for tests. These are existing-implementation checks, not proof that the new design is implemented.

The branch push trigger and literal-command CI step were temporary validation scaffolding. The final workflow is identical to baseline. The final head adds only this evidence and ADR prose clarifying stable extra ordering and rolling-deployment safety, and removes that scaffolding; normal PR CI runs again on the final head. There is no UI or runtime change in this PR.
