# ADR 0052: Appointment text is an editorial advisory

## Status

Accepted. Supersedes only the appointment-wording policy retained by [ADR 0045](0045-goal-grace-and-status-check.md). Its closure and goal-scoring decisions remain in force.

This record accepts the policy, not an implementation claim. At baseline main `d55500e1893d159d12a70988591b80b307ed0fad`, appointment checks still produce contradictions and can subtract 15 quality points. The implementation must follow this ADR's merge; the [current status guide](../content-system.md#content-score-status-checks) changes with that implementation.

## Context

[Issue 294](https://github.com/hmbanan666/k39/issues/294) describes a town whose always-open schedule loses quality points because its article or FAQ mentions an attraction visited by appointment. Its original acceptance sought subject inference that would exempt other attractions but retain a penalty for the page's own subject. The [revised maintainer acceptance](https://github.com/hmbanan666/k39/issues/294#issuecomment-6387179677) selects an advisory instead.

A title and free Russian prose do not reliably establish who a booking phrase belongs to. Ordinary inflection, modifiers, multiple subjects and omitted booking words make an expanding set of lexical rules an uncertain basis for a numeric penalty. A recognized phrase is evidence for editorial review, not certification that it describes this place. Failure to recognize a phrase is not proof that booking instructions are absent.

The existing metric couples every hard status contradiction to a 15-point quality deduction, once per page. It therefore treats an uncertain appointment inference like a closure contradiction. More subject rules would preserve that penalty for genuine mismatches, but would also preserve the cost of ordinary prose being misclassified. We choose less automatic scoring pressure in exchange for a more honest confidence boundary.

## Decision

### Appointment text never deducts points

Both text-dependent appointment cases are explicit editorial advisories:

- The schedule mode is `always` and the checked text contains recognized appointment wording: ask an editor to check whether that wording concerns this place or another attraction.
- The schedule mode is `appointment` and the checked text contains no recognized booking wording: ask an editor to check that readers have booking instructions.

Return these findings in `statusChecks(...).warnings`, never `contradictions`. Each costs zero points, including when the wording appears to name the page's own subject. An own-subject mismatch remains visible for editor review but no longer automatically lowers quality. Neither advisory asserts ownership of the text, proves a schedule error, or proves that booking instructions are missing. Do not build or retain an expanded appointment subject/parser engine to satisfy issue 294.

Keep the existing text inputs: article, hours, directions and individual FAQ answers, with the existing internal-link sentence exclusion. No additional fields or parallel schedule representation are introduced.

### Preserve independent contracts

Closure contradictions retain the existing 15-point quality deduction, once per page. Existing closure-subject handling and its zero-point ambiguous-subject warning remain unchanged. An appointment advisory does not suppress a separately established closure contradiction.

Canonical schedule rules, source validation and public availability continue to use the existing schedule/fact contracts. An advisory never changes the schedule, opening intervals, public status or structured data. All content writers, publication checks, pending-draft handling, owner-conflict protection, live-write restrictions and editor/draft bearer permissions remain unchanged. The publication stop-list guard addressed by [issue 293](https://github.com/hmbanan666/k39/issues/293) is independent and must remain effective.

There is no schema, token, feature-flag or content change, and no production score refresh is authorized by this decision.

### Keep advisories visible through existing consumers

At the baseline, the production trace is `statusChecks` → the place-only `statusPoints` → `scorePage` → `scoresFromCatalog`. Catalog scoring serves stored refresh and preview. `statusContradictions` is a compatibility wrapper with no production caller. No content writer or publication gate consumes the status penalty.

`statusPoints` already charges only `contradictions`, while flattening both arrays into the shared quality checks using `status contradiction:` and `status warning:` prefixes. Preserve that result shape. The appointment findings use `status warning:` and clear Russian advisory labels asking for review, rather than presenting inferred ownership or a mandatory scoring failure as fact.

Admin scores and MCP list/get/preview expose these checks. `topIssue` selects a check from the lowest-scoring block without a separate severity field, so an advisory may become the displayed issue; its label must retain the advisory meaning there too. Weekly reporting continues to use the same stored scores. Visibility does not imply a points deduction or publication veto.

`content_score_preview` uses the current scorer without replacing stored scores. Stored scores change through the normal successful daily refresh or an already-authorized forced refresh. Deploying the implementation does not invalidate a daily run claim, rewrite historical scores, or itself request a live refresh. The ADR alone changes neither preview nor stored results.

Implementation evidence must cover advisory visibility and zero appointment scoring impact for article and FAQ inputs, including live, pending and draft scoring, while retaining closure deductions and publication guards. Passing those cases demonstrates this advisory contract, not reliable attribution of arbitrary Russian prose.

## Consequences

Editors keep a prompt to inspect possible booking mismatches, including genuine own-subject mismatches, without a confidence claim that the prose parser cannot support. The deliberate cost is that a real booking inconsistency no longer loses 15 quality points automatically. Closure contradictions remain penalized; structured schedule correctness and publication safety remain separate obligations.

After implementation and a normal refresh, appointment-only deductions can disappear without an editorial content correction. A score increase is therefore a change in metric policy, not evidence that a page was repaired, its text belongs to one subject, or its visitor journey was accepted. Comparisons across that refresh must retain this qualification. No accuracy, false-positive rate or product-outcome improvement has been measured by accepting this ADR.
