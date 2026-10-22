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

Local Node is 24.19.0, within package.json engines; the repository and CI pin remains 24.21.0. Full PostgreSQL tests, standalone SSR and Alpine image verification are assigned to CI, which supplies Postgres 18 and Docker. The migration branch is temporarily included in the existing CI push trigger to obtain that evidence before opening the PR. Remove that trigger after the run; keep the normal main/PR behavior.

Lint, typechecks, non-database tests, production build, repeat-install stability and CI results will be recorded after they finish. No product routes, content or feature visibility changes are part of this migration.
