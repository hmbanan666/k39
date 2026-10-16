#!/usr/bin/env bash
# Runs once per environment build, after checkout. Idempotent.
set -euo pipefail
export PATH="/usr/local/bin:${PATH}"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export NUXT_TELEMETRY_DISABLED=1
cd "$(git rev-parse --show-toplevel)"

corepack pnpm install --frozen-lockfile
# Browser binaries live in the build snapshot, so later agents do not download them.
corepack pnpm exec playwright install chromium
sudo -n corepack pnpm exec playwright install-deps chromium

# The snapshot should know the current default branch. Agents still fetch
# again on boot (start.sh) because a build goes stale.
git fetch origin main

chmod 0755 scripts/git/strip-coauthor.sh scripts/git/post-commit
install -m 0755 scripts/git/post-commit .git/hooks/post-commit
