#!/bin/sh
# Remove Co-authored-by trailers from HEAD.
# Cloud agent VMs append the trailer in a commit-msg hook that runs after
# the repository hook, so this has to run from post-commit.
set -eu
cd "$(git rev-parse --show-toplevel)"
msg=$(git log -1 --format=%B)
printf '%s\n' "$msg" | grep -qi '^Co-authored-by:' || exit 0
tmp=$(mktemp)
hooks=$(mktemp -d)
trap 'rm -rf "$tmp" "$hooks"' EXIT
printf '%s\n' "$msg" > "$tmp"
node scripts/git/clean-commit-message.mjs "$tmp"
# hooksPath disables the platform hook, which would append the trailer again.
git -c core.hooksPath="$hooks" commit --amend -F "$tmp" >/dev/null
