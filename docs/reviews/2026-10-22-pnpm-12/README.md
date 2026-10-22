# pnpm 12 migration

Base: `2ab27948cae7569f2b8273548ee4cb29027a889c`. Target: pnpm 12.15.0.

## Changes

- Exact package-manager pin, matching engine range and cloud-agent image pin.
- Existing build-script decisions mapped one-for-one to `allowBuilds`: only sharp and better-sqlite3 allowed; previously ignored packages explicitly denied.
- CI explicitly uses `--frozen-lockfile`; the web image continues to follow the packageManager pin through Corepack.
- A scoped refresh of cssnano and its preset dependency tree resolves the existing trust-policy failure. cssnano moves from 9.6.0 to 9.9.0; obsolete preset/plugin packages leave the graph. PostCSS and browser support data update within their declared ranges. Direct application/tool dependency versions stay unchanged; generated peer resolution keys change.
- pnpm 12 records its own bootstrap dependency graph as the first YAML document in the lockfile; the application dependency graph is the second document.
- `trustPolicy: no-downgrade` and its two existing exclusions are unchanged. No additional trust exclusions or install-script permissions were introduced.

## Validation

`pnpm install --frozen-lockfile` completed on pnpm 12.15.0, including root prepare and Nuxt prepare, in 11.6 seconds with a warm store and verification cache. This is not a cold-install benchmark. Repository validation and whitespace checks pass.

Local Node is 24.19.0, within package.json engines; the repository and CI pin remains 24.21.0. Full PostgreSQL tests, standalone SSR and Alpine image verification are assigned to CI, which supplies Postgres 18 and Docker. A temporary push trigger obtained full CI evidence before the PR was opened. It was then removed; the final workflow keeps its normal main/PR triggers.

| Check | Result |
| --- | --- |
| Local repository validation, lint, all package and writer typechecks | Passed |
| Local web-app and map suites | 83 files, 594 tests passed |
| Local production build | Passed |
| Repeat frozen install | Passed; lockfile hash unchanged; 102 ms with warm caches |
| Direct application/tool dependencies | All 55 versions and specifiers match the baseline |
| Node 24.21.0 / pnpm 12.15.0 CI | Passed |
| Full suite with PostgreSQL 18 | 115 files, 772 tests passed |
| Standalone SSR outside workspace | Expected 200/404 responses passed |
| Production Alpine Docker build | Passed |

[CI run 39839951511](https://github.com/hmbanan666/k39/actions/runs/39839951511) tested commit `21943ba153fecdc2fc4160f97e77146f1e7417d1` before opening the PR. Its final follow-up only records evidence, clarifies Corepack setup commands and removes the temporary push trigger. It does not change dependencies, application code or build/install behavior. The normal PR checks run again on the final head.

The scoped lockfile refresh updated cssnano 9.6.0 -> 9.9.0, PostCSS 8.5.29 -> 8.5.31 and their browser support data. It adds six package versions and removes 51 obsolete versions from the application lock document. No trust-policy exception was added to get a passing install. No product routes, content or feature visibility changes are part of this migration.
