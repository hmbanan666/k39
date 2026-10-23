# ADR 0050: Admission extras and larger entry lists

## Status

Accepted on merge of this record (2026-10-23). Implementation pending. Amends the admission-list, fact-value and rendering decisions in [ADR 0046](0046-structured-practical-info.md); its other decisions remain. At baseline `cac4720` the running implementation still has one 12-row entry list and no extras.

## Context

[Issue 290](https://github.com/hmbanan666/k39/issues/290) reports lost prices for official audio guides, tours and other separately paid activities, plus entry tariffs that exceed 12 rows. [Inspection and official-source evidence](../reviews/2026-10-23-admission-extras/README.md) confirm the structural gap. This decision does not certify the stored prices of those pages or publish new content.

An audience describes who can buy a ticket. An audio guide is a service, not an audience. Putting its amount in a `general` row currently creates an entry `Offer`, can mark access as paid and suppresses the legacy entry-price summary. Some services are priced per group or device; a refundable deposit is a different amount again.

## Decision

### Two lists, one admission primitive

Keep entry tickets and paid extras as separate lists on the same place, venue or route. Continue using `admission_prices`, one shared writer and fact kind `admission`. Add a storage discriminator `kind: entry | extra`, defaulting existing rows to `entry`. Do not add a menu item, an event, a new audience or a second price writer for an extra.

| Field / rule | Entry | Extra |
| --- | --- | --- |
| Per-subject limit | 48 rows, replacing 12 | 12 rows, independent of entry capacity |
| Audience | Existing five values and conditions | Null; eligibility belongs in `condition` |
| Amount | Existing integer-ruble rules, including `free` at zero | Integer rubles greater than zero |
| Label | Existing override; identify the exhibition/product and audience when several tariffs exist | Required non-empty service name |
| Unit | Null; existing entry presentation | `person`, `group`, `device`, or null when the source does not state the basis |
| Condition | Existing rules | Source-stated eligibility, group size, duration or prerequisite entry ticket; no inferred inclusion |
| Provenance | Existing official-source, source-title and check-date rules | Same rules |

Keep the existing 80-character label, 200-character condition and 40-character slot limits. A slot is unique within subject and kind. The database uniqueness key becomes `(subject_type, subject_id, kind, slot)` and checks enforce the two shapes: entry has an audience and no unit; extra has no audience, a positive amount and a label. A unit must be one of the stated values or null. Every current row migrates to entry with its amount, source and check date unchanged. No row is classified from its label automatically.

48 is a bounded capacity decision, not an observed production count: the inspected art-museum tariff already contains six entry products with five audience cells each and a family product. Even combining identical school/pensioner amounts leaves more than 12 useful rows. Twelve extras covers the concrete service cases without turning the page into an unrestricted commercial catalog. Both limits reject overflow explicitly; never silently truncate a submitted list or the public rendering.

### Compatible writes and reads

Extend `admission_set` and the existing admin admission endpoint with optional `rows` (entry) and `extras` lists. At least one must be present. An omitted list is preserved; `[]` explicitly clears only that list. Validate every supplied list before writing and replace supplied row lists together in a database transaction. No old `rows`-only client may delete or retire extras. Omitted lists must be preserved in the transaction, not read and rewritten from an earlier snapshot. Same-list replacement keeps the existing last-save behavior; this is not optimistic concurrency control.

The shared writer applies the same source checks, writing guard, editor access, audit and draft/live-parent refusal to either list. A draft token still receives 409 on a live parent and stores no pending practical payload. The cabinet gets no new editing permission. A row omitted from a supplied list retires only that list's corresponding fact.

`admission_get` retains entry-only `rows`, `shown` and `stored`, and adds `extras`, `shownExtras` and `extrasStored`. The set response uses the same partitioning. Admin practical reads retain entry-only `admission` and add `admissionExtras`. `admissions_list` retains its entry counters and adds separate extra/stale-extra counters; `staleOnly` includes a subject stale in either list. An extras-only subject must remain discoverable. Do not reinterpret a legacy entry counter as a combined total.

### Facts and freshness

Entry fact slots stay `admission:{slot}` and their values remain `{ audience, priceRub, condition, label }`. Do not rewrite their value hashes, verification dates or history during migration.

Extra slots are `admission-extra:{slot}`, still fact kind `admission`, with value `{ kind: 'extra', priceRub, label, condition, unit }`. Extend the value schema as a union; the old entry shape remains valid without an added discriminator. Extra references use `short.admissionExtras`; entry references stay `short.tickets`. `fact_update` must resolve the slot's list, reject a mismatched value shape and go through the shared row writer while preserving the other list. `fact_confirm` keeps its existing hash contract. The namespace prevents an identically named extra from retiring an entry fact.

Both variants use admission's existing TTL, risk, source watcher and public freshness window from [the facts contract](../facts.md). Retired facts leave the queue by the existing retirement path. Update that contract and the MCP guide in the implementation PR. The current writer replaces database rows before committing facts; this ADR does not claim that existing row/fact synchronization is a single transaction. Implementation acceptance includes failure/retry evidence for the extended path and must not silently report an unsynchronized write as successful.

### Public output and scoring

Render fresh entries as «Билеты», followed by fresh extras as «Дополнительно». Sort extras by `sort_order`, then slot; entry audience ordering stays unchanged. Show the service label, amount, source-stated unit and condition. Null unit has no per-person default. Expose each row's source and check date in the shared public block; a page-level check date is not a substitute for row provenance. A table may show only extras; it must still give an honest entry summary.

Entry rows alone control the legacy `places.price` fallback, `AdmissionView.stored`, entry `offers`, `isAccessibleForFree`, admission-based practical scoring and the price-text-conflict warning. Extras never emit entry offers or change free-access inference. An audio-guide price alone cannot satisfy missing entry-price evidence. Update the database scoring aggregate as well as rendering helpers; filtering only JSON-LD is insufficient.

Stored but stale entries still show «Стоимость билета уточняйте» and suppress legacy entry prose. Stored but wholly stale extras show «Стоимость дополнительных услуг уточняйте»; with no stored extras, omit that group. Mixed lists show only fresh rows and retain the stored/stale counters for editorial checks. Extras-only storage does not suppress an existing entry summary; when no entry amount or summary exists, show «Стоимость билета уточняйте». Place, venue and route readers use the same rules, including SSR.

### Combined tickets and bounded scope

A combined ticket that includes admission is an entry product, identified by label and condition. Choose the larger-cap option in issue 290. Keep per-subject ownership: no shared ticket catalog, cross-subject subscriptions or automatic propagation in this change. Editors may record the same official combined product on each covered subject only when the source explicitly covers it; each row retains its own source and verification lifecycle. This duplication and its maintenance cost are an explicit limit. Collection-prose drift in issue 297 remains separate.

Keep only exact amounts stated by the source. Do not turn a range, a minimum, a quote-on-request service or an unstated price into an exact row. Refundable deposits are not service prices and have no numeric field in this increment; an editor can link the official rental conditions without copying the deposit amount into prose. Free included services can remain qualitative. Currency conversion, inventory, booking, payment, dynamic tiers, deposit accounting and a cross-page ticket catalog require separate scope decisions.

## Alternatives considered

| Option | Reason not selected |
| --- | --- |
| Add audience `service` | Mixes buyer category and product type; still risks entry markup/fallback/scoring leakage |
| Put labelled extras in `general` | Produces misleading entry offers with current code |
| Raise only the common cap | Does not distinguish paid entry from a service |
| New extras table / fact kind / writer | Repeats provenance, freshness and access behavior already owned by admission |
| Shared multi-subject ticket catalog now | Adds ownership, lifecycle and propagation work beyond the verified capacity/service gap |

## Consequences and delivery boundary

This record is the design deliverable for current-batch item 7. It changes no API, migration, public page or live content and does not close issue 290 by itself. Implementation follows after this ADR lands, as required by the repository workflow.

Estimate one medium-to-large implementation PR with three internal tasks, rather than three independently deployable schema/UI PRs:

1. Migration/types and the shared writer, partial-list replacement, fact union/namespaces, MCP/admin contracts and failure/permission regressions.
2. Public/admin presentation, scoring/JSON-LD isolation, freshness/fallback and consistent place/venue/route reads; reconcile current guides and skills. Include the `k39-ui` before/after evidence.
3. Boundary and compatibility acceptance: 48/49 entries, 12/13 extras, legacy values/hashes and rows-only clients, explicit clears, omitted-list preservation, duplicate slots across/within lists, invalid source/date/amount/unit/label, fact update/retirement, mixed/all-stale/empty/extras-only states, group/device units and entry-ticket prerequisites. Run the full gate, build, SSR and Docker.

This estimate is based on inspected callers, not a time promise. New defects or incompatible data must be recorded and resized explicitly. A separate post-deployment editorial pass re-reads official sources and verifies representative pages; it uses authorized editor writes, never a seed or automatic price migration. Keep issue 290 open until implementation and acceptance meet its agreed scope. Enable extra writes only after every running application instance uses the partition-aware writer, so a rolling deployment cannot expose extra data to the old whole-list writer. Rollback must preserve stored extras and fact history; do not deploy an old whole-list writer over extra data without a write guard or forward repair.
