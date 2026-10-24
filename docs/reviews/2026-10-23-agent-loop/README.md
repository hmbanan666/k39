# Agent setup and check-loop baseline

Task: A01, batch item 5. Base and measured product snapshot: `73bb36eda23d7b6abff1ad4242c42e30f6e38c0c` (PR 305 merged).

## Scope and additions

This task measures the existing workflow before A02 changes verification commands. It adds a portable exact-pin preflight (`node scripts/env/check-toolchain.mjs`, also `pnpm run check:toolchain`) and opt-in monotonic stage records (`K39_CHECK_TIMINGS=1 pnpm run check:quick`). The preflight invokes no package-manager shim under a mismatched Node. It does not install tools, rewrite a host PATH/profile, create a database or claim application readiness. Cursor's existing image adapter is unchanged. The timing flag preserves the existing command selection, order and failure exit codes.

The [local observation](local.json) is an existing managed Linux checkout with warm dependencies: Node 24.19.0 instead of the 24.21.0 pin, no psql or Docker. A previously downloaded pinned Node binary exits with SIGSEGV on this host. The preflight rejected the mismatch in 379ms and skipped pnpm invocation. This is a single fail-fast observation, not a clean-install result or a measured speedup.

## Reproducible CI measurement

The isolated baseline job uses stock Ubuntu, the project Node/pnpm pins, Postgres 18, no Cursor profile/exec-daemon, a fresh checkout and a new empty local pnpm store. Tools and the Postgres service are provisioned before the checkout-to-ready window; the hosted image and remote registry caches are uncontrolled. This is not a cold laptop or macOS provisioning measurement.

The first dev run includes migration/import on the dedicated local `k39_a01` database. Readiness requires both `/api/health` and an SSR article returning 200 with its title, not merely a listening port. The [start probe](measure-start.mjs) launches the resolved Nuxt CLI directly with the pinned Node and normal forked dev mode; pnpm wrapper time is excluded. It then repeats that command with the populated database and retained Nuxt/dependency caches. It refuses any database other than a loopback `k39_a01`, terminates its process group and waits for the port to be released. No production service or credentials are used.

The representative quick workload is the real PR 305 article-length change: baseline `73bb36e` against `ddc17b6`. Only the isolated job's `origin/main` tracking ref is set to that comparison base. The new instrumented quick script runs from the helper checkout with the baseline as its working directory; it does not edit baseline source or weaken checks. Full baseline verification and a web build follow. A separate normal build/Docker gate verifies this task's changed code.

[Complete run](https://github.com/hmbanan666/k39/actions/runs/39978842660), helper commit `318e802d9a05125de82fa8b574b5e46d78247d46`; [raw host, phase and timing records](ci-baseline.json). The measured host was Linux x64, 4 available CPUs, 15.6 GiB RAM, Node 24.21.0, pnpm 12.15.0 and Postgres 18.6. The successful preflight and fresh install demonstrate setup without the Cursor adapter. This is one complete run, not variance/p95 evidence or a speedup claim. Two incomplete setup/probe attempts are excluded; their partial numbers are not mixed into this result.

| Measurement | Observed | Scope / precision |
| --- | --- | --- |
| Checkout to first SSR-ready | About 33s | Starts at baseline checkout; tools and Postgres already provisioned; Actions start timestamp has one-second precision |
| Cold local-store install | 12s | Empty local pnpm store; remote registry caches uncontrolled |
| First dev readiness | 18.884s | Node launches Nuxt to health + article SSR, includes first boot migration/import |
| Warm dev readiness | 16.952s | Same command/database/cache after the first process has fully stopped |
| Warm install | 82ms reported by pnpm | Same workspace/store; below one-second Actions timestamp resolution |
| Representative quick | 58.700s sum of stages; about 59s wall | Real PR 305 diff; 153 tests in 10 files passed |
| Baseline full check | About 148s | Literal check:full, 860 tests in 119 files, clean diff after lint fixes |
| Baseline web build | About 45s | Follows the full check |
| Baseline standalone SSR | About 3s | Additional deployed-output check; all assertions passed |

The full check + web build took about **193s**; adding standalone SSR makes about **196s**. Provisioning and Docker build are separate, not hidden inside that sum.

| Representative quick stage | Time | Share of reported stages |
| --- | --- | --- |
| Repository checks | 0.142s | Less than 1% |
| Lint | 3.576s | 6% |
| Web-app + writer typechecks | 41.971s | 71.5% |
| Related tests | 13.011s | 22.2% |

The [local diagnostic quick run](local.json) passed 15 tests and all selected typechecks, with 290.517s summed stages; web-app/writer typechecks took 220.938s (76%). It changed root package scripts and therefore selected all four package typechecks. Its host, unsupported runtime and workload differ from the CI feature baseline: compare the measured dominant stage, not absolute elapsed time or host speed.

The measured bottleneck is the web-app/writer typecheck stage. A02 should inspect its scope alongside the required read-only final gate and transitive-consumer proof. Removing writer coverage or raising test timeouts is not an optimization demonstrated here. No application/check speed improvement has yet been measured.

To reproduce, use the [exact workflow at the tested commit](https://github.com/hmbanan666/k39/blob/318e802d9a05125de82fa8b574b5e46d78247d46/.github/workflows/ci.yml), or provision the pinned tools and an isolated Postgres 18 database, check out the baseline into a new directory with an empty pnpm store, and run the same commands. For the startup probe from that directory:

```bash
# DATABASE_URL must already name a loopback database exactly k39_a01.
# App boot migrates/imports this isolated database.
node /absolute/path/to/review/measure-start.mjs
```

Keep the raw command list, cache state and comparison refs with any new run. Do not compare a docs-only quick check to a feature edit or call an inherited store cold.

## Validation and limits

Fifteen focused tooling tests and the local timed quick check pass, including six preflight cases and timing-enabled/disabled child failure propagation. [Full pre-PR CI](https://github.com/hmbanan666/k39/actions/runs/39978842660) passed on `318e802d9a05125de82fa8b574b5e46d78247d46`: frozen install, literal check:full, clean diff after lint fixes, all typechecks, **868 tests across 120 files**, production workspace build, standalone SSR and Docker. The separate baseline job also passed all measured steps above. Local Node remains 24.19.0 and local Postgres/Docker are unavailable; local diagnostic success is not pinned-environment acceptance.

The final follow-up records measurements and restores the original CI workflow; preflight, quick runner, tests and startup probe contents are unchanged. Normal PR CI checks that final head again. No UI, product data, migration, dependency pin or permission-boundary changes are included. The subsequent [verification-coverage review](../2026-10-23-verification-coverage/README.md) records the transitive-consumer and read-only lint proof.
