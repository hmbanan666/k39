# Agent setup and check-loop baseline

Task: A01, batch item 5. Base and measured product snapshot: `73bb36eda23d7b6abff1ad4242c42e30f6e38c0c` (PR 305 merged).

## Scope and additions

This task measures the existing workflow before A02 changes verification commands. It adds a portable exact-pin preflight (`node scripts/env/check-toolchain.mjs`, also `pnpm run check:toolchain`) and opt-in monotonic stage records (`K39_CHECK_TIMINGS=1 pnpm run check:quick`). The preflight invokes no package-manager shim under a mismatched Node. It does not install tools, rewrite a host PATH/profile, create a database or claim application readiness. Cursor's existing image adapter is unchanged. The timing flag preserves the existing command selection, order and failure exit codes.

The [local observation](local.json) is an existing managed Linux checkout with warm dependencies: Node 24.19.0 instead of the 24.21.0 pin, no psql or Docker. A previously downloaded pinned Node binary exits with SIGSEGV on this host. The preflight rejected the mismatch in 379ms and skipped pnpm invocation. This is a single fail-fast observation, not a clean-install result or a measured speedup.

## Reproducible CI measurement

The isolated baseline job uses stock Ubuntu, the project Node/pnpm pins, Postgres 18, no Cursor profile/exec-daemon, a fresh checkout and a new empty local pnpm store. Tools and the Postgres service are provisioned before the checkout-to-ready window; the hosted image and remote registry caches are uncontrolled. This is not a cold laptop or macOS provisioning measurement.

The first dev run includes migration/import on the dedicated local `k39_a01` database. Readiness requires both `/api/health` and an SSR article returning 200 with its title, not merely a listening port. The [start probe](measure-start.mjs) launches the resolved Nuxt CLI directly with the pinned Node and normal forked dev mode; pnpm wrapper time is excluded. It then repeats that command with the populated database and retained Nuxt/dependency caches. It refuses any database other than a loopback `k39_a01`, terminates its process group and waits for the port to be released. No production service or credentials are used.

The representative quick workload is the real PR 305 article-length change: baseline `73bb36e` against `ddc17b6`. Only the isolated job's `origin/main` tracking ref is set to that comparison base. The new instrumented quick script runs from the helper checkout with the baseline as its working directory; it does not edit baseline source or weaken checks. Full baseline verification and a web build follow. A separate normal build/Docker gate verifies this task's changed code.

Measured values, exact run/commit and validation results will be inserted after the job completes. One run establishes a baseline; it does not establish variance, p95 latency or an improvement over another host.

To reproduce, use the exact workflow at the tested commit recorded below, or provision the pinned tools and an isolated Postgres 18 database, check out the baseline into a new directory with an empty pnpm store, and run the same commands. For the startup probe from that directory:

```bash
# DATABASE_URL must already name a loopback database exactly k39_a01.
# App boot migrates/imports this isolated database.
node /absolute/path/to/review/measure-start.mjs
```

Keep the raw command list, cache state and comparison refs with any new run. Do not compare a docs-only quick check to a feature edit or call an inherited store cold.

## Validation and next step

Fifteen focused tooling tests pass, including six preflight cases and timing-enabled/disabled child failure propagation. Local quick/full CI results and measured bottleneck are pending. No UI, product data, migration, dependency pin or permission-boundary changes are included. The remaining A02 task must preserve final verification coverage and demonstrate transitive type failures before changing selection.

Current batch: **4 of 7 merged**, item 5 awaiting measurement/merge. Next: A02, then the admission-extras design decision in #290. See the [roadmap](../../roadmap.md).
