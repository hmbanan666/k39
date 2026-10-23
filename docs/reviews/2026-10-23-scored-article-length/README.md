# Scored article text length

Task: issue [289](https://github.com/hmbanan666/k39/issues/289), F23, batch item 4. Base: `ddc17b6b0a2a16b97c08467cc7bc45cf120439bf` (PR 301 merged).

## Trigger and metric

The scorer used prepared Markdown's raw `.length` for article floors, ceilings, the long-page filler gate and stored `signals.bodyChars`. Link destinations could penalize a useful article or let a short one pass its floor. On the isolated place fixture, 6000 authored characters became 6485 raw characters solely because of a link target. The historic production article and score quoted in the issue were not revalidated or edited.

`shared/article-length.ts` now obtains authored text through the existing, unchanged public Markdown renderer. This avoids a second Markdown grammar. Link labels and heading text count; destinations and supported formatting/list/table syntax do not. Generated Meta link marks are chrome and do not count. Blocks and table cells are separated; whitespace collapses to one space and outer whitespace is trimmed. Character units remain JavaScript UTF-16 units. The renderer's escaping is decoded once, so literal HTML/entities and unsupported Markdown count as actually displayed rather than being silently discarded.

Existing article preparation is retained: strip a repeated place lead, fold directions, and use a collection's module prose projection. Structured FAQ is not newly added to article length. One count feeds the floor, effective ceiling, default-ceiling filler gate and `bodyChars`; preview, catalog scoring, stored signals and weekly reports share it. Filler analysis still receives Markdown so H2/paragraph structure remains available.

This corrects ADR 0016's public-article measure without changing its limits or ADR 0034's earned-length evidence, hard cap, stale-override or filler penalties. Venue descriptions retain their separate 300–600 rule. Save-response `bodyLength` remains the raw stored body; the current score preview supplies scored `bodyChars`. The subsystem guide and MCP content guide explain the distinction. Public rendering, content, schedules, schema and dependencies are unchanged.

## Regression evidence

- Before the fix, seven new scoring cases failed and the existing 38 passed. Afterward, four focused suites passed all 74 tests.
- [Article metric](../../../apps/web-app/test/article-length.test.ts): 14 cases for internal/external links, supported formatting, lists/tables, whitespace, literal HTML/entities, malformed/unsupported Markdown, inline word boundaries, generated link marks and Unicode units.
- [Scoring](../../../apps/web-app/test/scoring.test.ts): five article types at their exact ceiling and below their floor despite long targets; filler is not activated by markup alone; repeated-lead removal and folded directions use the same measure. Existing actual-overlength, override validation/staleness and real filler penalties remain covered.
- [Preview/storage](../../../apps/web-app/test/score-preview.test.ts): live and pending previews match catalog scoring and `toStored` signals at 6000; the original live catalog remains unchanged. Existing preview publication/indexing rules and [length-override tests](../../../apps/web-app/test/length-override.test.ts) pass.

## Validation and rollout

Focused suites passed (74 tests). Local repository validation, changed-file lint, web-app/writer typechecks and document-link/diff checks passed. The wider local `check:quick` failed: one related writer suite could not start without Postgres/Docker, and MCP registration exceeded its normal five-second limit. Its summary was 137 passed, 1 timed out and 15 skipped. Those same suites passed in full CI with the normal settings; no timeout or database guard was relaxed. Local tooling is Node 24.19.0 / pinned pnpm 12.15.0; CI provides the project Node pin and Postgres 18.

[Full pre-PR CI](https://github.com/hmbanan666/k39/actions/runs/39973970231) passed on `8dcf9a9b1636020976594ce8e10aa4c439eb93b2`: frozen install, literal `pnpm run check:full` (repository validation, lint with fixes, all typechecks and 860 tests across 119 files), a clean diff after that gate, production workspace build, standalone SSR and Docker image build. The final follow-up only records this evidence and restores the original workflow after its temporary branch trigger/full-command invocation. Final CI policy matches the base, and scorer/helper/test/guide contents are unchanged. Normal PR CI verifies the final head again.

After merge, verify the deployed SHA and read-only score preview on representative linked articles. Existing stored scores and weekly reports keep their previous numbers until the next successful daily refresh or an authorized forced refresh; the daily claim can skip a same-day restart. No production refresh or article write is performed here. Review changed counts as a corrected metric, not proof that each article has earned its length or passed editorial acceptance.

Current batch: **3 of 7 merged**, item 4 awaiting merge. Next is A01: measure setup, warm start, quick and full checks before changing the agent workflow. Newly reported #302–#304 remain unverified intake outside the fixed seven-item denominator; see the [roadmap](../../roadmap.md).
