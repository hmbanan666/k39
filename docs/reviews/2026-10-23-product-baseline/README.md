# Product baseline review

Base: `9f8a8ab09cb12218073c800773ed92606ae80b90` (merged PR 285). Date: 2026-10-23.

## Result

The repository now has a 25-capability implementation inventory and a sequenced stabilization queue. This replaces the former scoring/offers-only roadmap. The inventory separates code presence, narrow test contracts, dated HTTP observations and unverified full scenarios. Dispositions such as hiding quests or restricting pilots remain proposals; no route, feature flag, content, account or schema changes in this PR.

Three public fixes lead the queue: S01 availability failure on venue listings, S02 map sitemap/title/footer consistency, and S03 eat-now geolocation feedback. Each has implementation starting points and an acceptance contract. Agent setup measurement, tourist-core journeys, editorial/recovery acceptance and unfinished scope decisions follow. PRs 284–285 are recorded as completed work rather than reopened tasks.

## Evidence

- Rechecked the four static gaps on this base: `toggleOpen()` converts rejection to an empty list; map sitemap registration is absent; `loadMap()` goes through the region-appending collection-title path; `/map` is duplicated in footer links; eat-now geolocation rejection has no feedback. No production failure injection was performed.
- Matched the feature rows to actual pages, readers, writers and representative existing test contracts. There are 51 page files, 96 API handlers, 91 MCP definitions and 115 tracked test files; these counts do not measure readiness.
- The original HTTP observations are explicitly dated 22 Oct. Production deployment SHA, logins, browser journeys, live configuration and recovery are not claimed verified.
- No mass ADR status rewrite: the index explains that accepted decisions may have deferred phases. ADR 0017 already explicitly defers code claims/redemption/billing; its history is retained.

## Validation

- `check:quick` passed: repository validation and Markdown ESLint; no typechecks or tests selected for these Markdown paths.
- All 118 local Markdown links/anchors in the five changed documents resolve; `git diff --check` passed.
- [Full pre-PR CI](https://github.com/hmbanan666/k39/actions/runs/39930954086) passed on `899f83610b15544718e0cf662d2a06195a381a2c`: frozen install, repository validation, ESLint, all typechecks, 772 tests across 115 files, production build, standalone SSR smoke and Docker image build. The merged-base [main CI](https://github.com/hmbanan666/k39/actions/runs/39930255821) also passed.
- A temporary branch push trigger enabled the full run before PR creation; it is removed from the final diff. The follow-up only records this evidence and removes that trigger. Normal PR CI verifies the final head again.
- The final diff contains five Markdown documents; runtime, scripts, skills, dependencies and CI policy are unchanged. No implementation-mirroring tests were added for documentation.
