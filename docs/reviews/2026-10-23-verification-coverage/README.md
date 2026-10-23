# A02: verification coverage

Date: 2026-10-23. Baseline: `349a2c6359b40887940a807353115c10feefe402` (PR 309 merged).

## Change and acceptance

`check:full` uses read-only lint. Formatting is an explicit `lint:fix` action. Repository validation, all typechecks and all tests remain in the full gate. Nuxt generated ignored files and the isolated test database are still written by their existing checks.

Quick typecheck selection reads workspace globs and local dependency names from manifests. It includes transitive consumers, including paths through packages without a typecheck script. Root configuration and unresolvable removed workspace paths check all packages. Writer-only test changes retain the focused server-project check; normal database changes include web. Related-test selection and failure propagation remain unchanged.

## Evidence

Locally, temporarily widening `priceFreshCutoff` to `string | null` passed the types compiler but failed the database compiler in `src/repository/prices.ts` (TS18047 and TS2769). The implementation still returned a string; the temporary annotation was restored. This demonstrates a consumer-only type error, not a local pass of the whole previous quick command.

Thirteen focused tests pass: workspace closure through dev/peer/optional dependencies, intermediates without scripts, exclusion globs, cycles, types/map/database consumers, root configuration, removed packages, writer routing and existing timing/failure propagation.

The [isolated probe](probe.mjs) runs the complete baseline quick against that mutation, then the new runner against the same checkout. It separately introduces a formatting-only defect, checks that full verification fails without changing its bytes, and checks that explicit formatting fixes it. It restores all temporary files and asserts a clean clone. The probe passed in [CI run 39987457386](https://github.com/hmbanan666/k39/actions/runs/39987457386), `contract-proof` job, tested commit `fc6fd2d1c99a93adc604ab8d86d0fe726d0a342c`:

| Experiment | Baseline command | New command / result |
| --- | --- | --- |
| Shared contract widened to `string \| null` | Whole old quick exits 0: provider compiler passes, 573 tests in 60 files pass | New quick exits 1 at the database typecheck, with the expected TS18047/TS2769 consumer diagnostics |
| Valid TypeScript with wrong quotes/semicolon | Formatting-only fixture | New `check:full` exits 1 at lint and preserves exact source bytes; explicit `lint:fix` exits 0 and changes the fixture |
| Cleanup | Disposable clone | Contract, manifest and fixture restored; clone is clean |

The job uses the original baseline checkout and changes only the contract for the first experiment; the new runner is loaded from the tested helper checkout. The second experiment temporarily uses the new root command manifest. Expected compiler/lint failures are assertions inside the successful proof job; they are not failures of the unmodified branch. The same tested commit passed the literal `pnpm run check:full` command: 872 tests in 121 files, every package typecheck and repository/lint validation. `git diff --exit-code` then passed, followed by the web build and standalone SSR smoke. Docker passed in its separate job. CI used Node 24.21.0, pnpm 12.15.0 and Postgres 18.

The proof job and branch push trigger were temporary measurement scaffolding in that tested commit. The final workflow is byte-for-byte identical to the baseline; normal PR CI runs against the final head. Only this evidence/current-guide prose and removal of that temporary workflow differ from the tested implementation.

Local whole quick also passed on the managed host: 13 tests in 2 files. Stage timings in milliseconds: repository 1241, lint 11177, types 5220, database 34067, map 6151, web/writer 232263, tests 14899 (305018 total). This is a root-command/tooling change, so all packages were selected. The Node mismatch and different host/workload make these diagnostic numbers unsuitable for a speedup comparison.

## Limits

The managed local host runs Node 24.19.0 rather than the 24.21.0 pin and has no local Postgres/Docker. Full validation and the isolated probe use pinned CI tools and Postgres 18. No new runtime behavior, migration, dependency version or tool pin is introduced. No UI changes are included.

This closes verification correctness gaps. It makes no speedup claim: a shared-types change now checks more packages. The A01 baseline identified web/writer compilation as the largest measured quick stage; safe latency work remains a separate follow-up requiring equivalent workloads and environments.
