# A02: verification coverage

Date: 2026-10-23. Baseline: `349a2c6359b40887940a807353115c10feefe402` (PR 309 merged).

## Change and acceptance

`check:full` uses read-only lint. Formatting is an explicit `lint:fix` action. Repository validation, all typechecks and all tests remain in the full gate. Nuxt generated ignored files and the isolated test database are still written by their existing checks.

Quick typecheck selection reads workspace globs and local dependency names from manifests. It includes transitive consumers, including paths through packages without a typecheck script. Root configuration and unresolvable removed workspace paths check all packages. Writer-only test changes retain the focused server-project check; normal database changes include web. Related-test selection and failure propagation remain unchanged.

## Evidence

Locally, temporarily widening `priceFreshCutoff` to `string | null` passed the types compiler but failed the database compiler in `src/repository/prices.ts` (TS18047 and TS2769). The implementation still returned a string; the temporary annotation was restored. This demonstrates a consumer-only type error, not a local pass of the whole previous quick command.

Thirteen focused tests pass: workspace closure through dev/peer/optional dependencies, intermediates without scripts, exclusion globs, cycles, types/map/database consumers, root configuration, removed packages, writer routing and existing timing/failure propagation.

The [isolated probe](probe.mjs) runs the complete baseline quick against that mutation, then the new runner against the same checkout. It separately introduces a formatting-only defect, checks that full verification fails without changing its bytes, and checks that explicit formatting fixes it. It restores all temporary files and asserts a clean clone. CI execution and full-gate results are pending.

## Limits

The managed local host runs Node 24.19.0 rather than the 24.21.0 pin and has no local Postgres/Docker. Full validation and the isolated probe use pinned CI tools and Postgres 18. No new runtime behavior, migration, dependency version or tool pin is introduced. No UI changes are included.

This closes verification correctness gaps. It makes no speedup claim: a shared-types change now checks more packages. The A01 baseline identified web/writer compilation as the largest measured quick stage; safe latency work remains a separate follow-up requiring equivalent workloads and environments.
