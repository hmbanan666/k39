# Complete closure words in content scoring

Task: issue [291](https://github.com/hmbanan666/k39/issues/291), F23, current batch item 3. Base: `66a3241a56dbb7a6195afbebd9d21e30eea88f48` (PR 300 merged).

## Trigger and correction

The final `CLOSED` alternative was `^закрыт`, so a sentence or FAQ answer beginning with footwear advice (`Закрытую обувь…`) became a definite closure. The place scorer then reported `text says closed, schedule mode is always` and deducted 15 quality points.

The bare sentence-opening alternative now requires a complete short form: `^закрыт[аоы]?(?!\p{L})`. The Unicode letter check prevents backtracking into a prefix of an adjective or noun; JavaScript's ASCII-oriented `\b` is unsuitable here. Case-insensitive matching and punctuation still work. Contextual closure phrases, subject/tenant/quote rules, appointment checks and penalty size are unchanged.

This helper is used by the place scoring path, including catalog refresh and preview. It does not set schedule mode or public venue availability. No UI, content, schema, dependency or production-data writes are included.

## Regression evidence

- Added 11 parameterized [status cases](../../../apps/web-app/test/status-consistency.test.ts): seven adjective/noun prefixes through article and FAQ inputs do not establish a closure, including when a closed schedule still needs an explanation; four complete short forms retain open/closed contradictions, punctuation and uppercase behavior.
- Added one [scoring regression](../../../apps/web-app/test/scoring.test.ts): the fort footwear FAQ has the same quality checks, quality points and total with an always-open schedule as without the status check. A real FAQ closure still costs 15 quality points against an open schedule.
- Before the fix, these two suites had 8 failures / 53 passes. After the fix, all 61 tests passed, including existing tenant, historic-name, clause, weekly-day-off and actual-closure cases.

Issue [294](https://github.com/hmbanan666/k39/issues/294) was checked separately with an isolated town-title/always-mode input describing a brewery by appointment. It still returns the appointment contradiction. That is a distinct subject-scoping issue and is not resolved by this lexical correction. The [roadmap](../../roadmap.md) keeps it outside the current seven-item batch, alongside the newly reported #297–#299 without claiming those reports were reproduced.

## Validation and rollout

Focused suites passed (61 tests). Local repository validation, changed-file lint, web-app/writer typechecks and document-link/diff checks passed. The wider local `check:quick` failed: a related DB suite could not start without Postgres/Docker, and MCP registration plus two venue-helper tests exceeded the normal five-second limit. Its summary was 130 passed, 3 timed out and 15 skipped. All of those tests passed with the normal settings in full CI; no repository timeout or database guard was relaxed. Local tooling is Node 24.19.0 / pinned pnpm 12.15.0; CI provides the project Node pin and Postgres 18.

[Full pre-PR CI](https://github.com/hmbanan666/k39/actions/runs/39958680979) passed on `8789608e9697f94fb8035a763b1727b8f5a77d96`: frozen install, the literal `pnpm run check:full` gate (repository validation, lint with fixes, all typechecks, 837 tests across 118 files), a clean diff after that gate, production workspace build, standalone SSR and Docker image build. The final follow-up only records this evidence and restores the original workflow after its temporary branch trigger/full-command invocation. Final CI policy matches the base; scorer and test contents are unchanged. Normal PR CI verifies the final head again.

After merge, verify the deployed SHA and use a read-only score preview on a suitable page to confirm the footwear wording produces no closure contradiction while actual closure wording still does. Existing stored scores are not automatically rewritten by deployment: the daily refresh claims each UTC date, so a restart after today's prior claim can skip it. Wait for the next successful daily run, or have an authorized editor request a forced refresh, before treating the stored score as refreshed. This task does not perform that production write or certify the issue's historic production total of 83.

Current batch: **2 of 7 merged**, item 3 awaiting merge. Next is issue [289](https://github.com/hmbanan666/k39/issues/289), agreeing and applying the visible-article-length measure across score consumers.
