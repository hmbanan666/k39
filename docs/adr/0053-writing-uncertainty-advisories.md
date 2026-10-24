# ADR 0053: Ambiguous writing forms are editorial advisories

## Status

Accepted. Defines the confidence boundary for the ambiguous pronoun/superlative findings in [issue 293](https://github.com/hmbanan666/k39/issues/293), using that issue's explicitly allowed advisory fallback. It amends [ADR 0034](0034-earned-length-ceilings.md) only to exclude these advisories from stop-list filler penalties. Other writing bans and length rules remain in force.

This accepts a policy, not an implementation claim. At baseline main `efc71b6633269d14839ec6f912887ec522b65ba5`, the shared writing rule still reports ambiguous forms as blocking hits. Runtime implementation must follow this ADR's merge. Current writing guides change with that implementation; earlier ADRs, including [ADR 0052](0052-appointment-text-advisories.md), retain their decision history.

## Context

Russian emphatic-pronoun forms can coincide with superlative forms. A hard refusal can therefore reject neutral directions or descriptions. For example, «у самой Куршской косы» and «у самого Балтийского моря» describe location; a following adjective-like word does not establish promotional evaluation, since a geographic name may contain that word too.

Issue 293 originally allowed either a context heuristic or warnings for ambiguous forms. Expanding the next-word heuristic cannot reliably decide which sense an editor intended. Geographic-name exceptions would only make that confidence claim depend on a growing local list. The selected fallback exposes uncertainty and leaves style review to an editor. These examples explain the boundary; they are not a whitelist or an exhaustive classification of forms.

At the baseline, `shared/writing.ts` owns the stop-list and `writingHits`. `server/utils/mcp/writing-guard.ts` turns findings into `writingWarnings` on draft saves and into a refusal for a published result. The shared writers in `server/utils/content/save.ts`, and practical-information and notice writers using that gate, carry the result to admin/API/MCP callers. Separately, `longPageFiller` in `shared/length-override.ts` reads `writingHits`; above the default article ceiling, a hit can trigger the existing quality deduction through `shared/scoring.ts`.

Downgrading only the publication error would leave the same uncertain inference penalizing the quality metric. Reimplementing it in each consumer would allow publication, scoring and author guidance to disagree.

## Decision

### One canonical distinction between blockers and uncertainty

The canonical writing module, `apps/web-app/shared/writing.ts`, owns the classification and one shared analysis of blocking findings and uncertainty advisories. The implementation classifies the exact form set there. This ADR does not duplicate the stop-list, inflection tables or matching expressions. Compatibility helpers may project that analysis; writers, scoring and guide generation must not add independent form tables or context classifiers.

Truly context-ambiguous pronoun/superlative forms produce explicit uncertainty advisories. They do not claim the phrase is neutral, promotional, grammatically correct or attributed to a known subject. Their labels ask for manual style review. They cause neither publication refusal nor a numeric quality or filler penalty, including when a particular use is genuinely promotional. No geographic-name whitelist or context grammar is introduced.

Unambiguous superlative forms remain blocking. Independent phrase, pattern, venue-copy and banned-source rules retain their existing behavior, as do existing lookalike-word exclusions. An advisory never masks a blocking finding in the same passage or another field. The manual writing and publish-review standards still apply to prose that an automated check permits.

### Shared propagation and publication behavior

Use the existing shared writer/gate flow and `writingWarnings` response channel. Advisory labels must explicitly distinguish uncertainty from a confirmed violation. A nonempty warnings array alone is no longer a reason to refuse publication: only blocking findings can trigger the writing refusal. A successful authorized publish still returns its advisories.

The same analysis and advisory visibility apply to rendered prose in article fields, FAQ, modules and other fields already checked by the shared writers. Admin/API and MCP callers, draft and pending saves, and editor-authorized live writes and publication receive the advisories. They must not disappear merely because a save succeeded or because the request used a different transport. Preserve the existing prose/official-name split and banned-source coverage rather than expanding or narrowing checked fields.

All publication, bearer, pending-draft, live-write, source and owner-conflict restrictions remain independent and unchanged. An advisory cannot authorize a write, publish an agent draft, bypass review, or weaken another validation failure. No schema, token, flag or production-content operation is part of this decision.

### Scoring and refresh behavior

The filler consumer uses the same canonical analysis and penalizes only blocking writing findings. An uncertainty advisory must not be converted into a penalized `stop-list:` filler check or indirectly trigger a deduction because a combined findings array is nonempty. Other filler evidence, including repetition and independent blocking bans, retains its existing penalty. Default and earned length ceilings are unchanged.

Current-scorer preview remains separate from stored scores. Stored scores use their normal successful daily refresh or an already-authorized forced refresh; this decision requests no live refresh and does not invalidate a daily run claim. Neither the ADR nor its publication changes stored content or scores.

Implementation evidence must cover advisory return/visibility and absence of refusal or point loss across the shared admin/API/MCP writer paths, body/FAQ/module inputs, draft/pending saves and editor publication. It must also retain unambiguous-superlative and independent-ban refusals, independent filler deductions and authorization/source/owner protections. Those checks establish the selected confidence boundary, not reliable grammatical classification of arbitrary Russian.

## Consequences

An editor can save and publish neutral emphatic phrasing without an automatic refusal from this ambiguous rule. The deliberate cost is that genuinely promotional uses of the same ambiguous forms also require manual style review and receive no automatic numeric penalty. Explicit advisories preserve that review prompt; they are not approval of the copy.

After implementation, a previously refused text may pass the automated gate, or a score may rise after its normal refresh, without a prose correction. That reflects the confidence and metric policy change, not proof of better writing, correct subject inference or an accepted visitor journey. No classifier accuracy, false-refusal rate or editorial outcome has been measured by accepting this ADR.
