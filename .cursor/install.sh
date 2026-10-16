#!/usr/bin/env bash
# Runs once per environment build, after checkout. Idempotent.
set -euo pipefail
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export NUXT_TELEMETRY_DISABLED=1
cd "$(git rev-parse --show-toplevel)"

bash scripts/env/node-path.sh
hash -r

corepack pnpm install --frozen-lockfile
# Browser binaries live in the build snapshot, so later agents do not download them.
corepack pnpm exec playwright install chromium
sudo -n corepack pnpm exec playwright install-deps chromium

# The snapshot should know the current default branch. Boot fetches again
# because a build goes stale. The platform does not wait for start.sh.
bash scripts/git/sync-branch.sh

chmod 0755 scripts/git/strip-coauthor.sh scripts/git/post-commit scripts/git/sync-branch.sh scripts/env/node-path.sh
install -m 0755 scripts/git/post-commit .git/hooks/post-commit
