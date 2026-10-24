# Pending place verification date

Issue: [288](https://github.com/hmbanan666/k39/issues/288). Current seven-item batch: item 1; **0/7 merged**, implementation under review. Base: `287f82dd1439f982483fd4120b26868cd253eae4` (PR 292 merged).

## Trigger and change

A draft-token write against a checked published place stores its PostgreSQL lastVerifiedAt value in a pending payload. A later write that omits factsCheckedAt previously revalidated that value and rejected +HH offsets such as `2026-10-12 00:00:00+00`. The actual place_get reader returns the same database representation, so sending its value back also failed.

The pending writer now validates only an explicitly supplied date. Omission preserves the pending or live value exactly, including microseconds, a pending null and the legacy factsCheckedAt payload alias. An explicit null stays cleared on later omitted writes instead of falling back to the live date. Explicit timestamps accept PostgreSQL +HH offsets and up to six fractional digits alongside existing ISO forms, and normalize to the API's existing millisecond ISO result. Invalid dates, clocks and offsets still fail.

This does not change publication scope, the shared content writer, owner conflicts, schema, API field names or bearer permissions. A draft token still stages changes; editor application remains required for the live row.

## Regression evidence

- Added 16 parser vectors to [mcp-content.test.ts](../../../apps/web-app/test/mcp-content.test.ts). The baseline failed five newly added valid timestamp cases; after the parser change all 26 tests in that file passed. Existing undefined/null/date-only semantics and invalid-input rejection remain covered.
- Added three PostgreSQL writer regressions to [pending-publish.writer.test.ts](../../../packages/database/src/repository/test/pending-publish.writer.test.ts): consecutive saves and the actual place_get read/write date, retained pending null, and replacement date followed by omission. They check retained edits, unchanged live content/date before editor application, and the applied date afterwards.
- The read/write regression also retains the exact inherited microsecond timestamp before an explicit date is supplied. Explicit input normalization remains millisecond precision, as documented above.

## Validation

Local repository/lint/link/diff checks, parser regression (26 tests), application typecheck and the corrected writer-test typecheck passed.

[Full pre-PR CI](https://github.com/hmbanan666/k39/actions/runs/39947236000) passed on `e1c5be9617679f57de7bd8631db5bf14b13a0798`: frozen install, repository validation, ESLint, all typechecks, 813 tests across 117 files, production build, standalone SSR smoke (including map metadata/final sitemap XML), and Docker image build. The three new PostgreSQL regressions passed with the real reader, pending writer and editor application. The final follow-up only records this evidence and removes the temporary branch push trigger. A later documentation-only intake update records reports 293–295 outside the agreed seven-item batch; none is claimed reproduced or fixed here. CI policy is unchanged in the final diff; normal PR CI checks the final head again. The local host has no Postgres/Docker, so database tests run in CI with Postgres 18. No production content, bearer or configuration is used or changed.
