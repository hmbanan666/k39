#!/bin/sh
# Remove Co-authored-by trailers from HEAD.
# Cloud agent VMs append the trailer in a commit-msg hook that runs after
# the repository hook, so this has to run from post-commit.
set -eu
cd "$(git rev-parse --show-toplevel)"
msg=$(git log -1 --format=%B)
printf '%s\n' "$msg" | grep -qi '^Co-authored-by:' || exit 0
cleaned=$(printf '%s\n' "$msg" | grep -vi '^Co-authored-by:' | sed -e :a -e '/^[[:space:]]*$/{$d;N;ba' -e '}')
if [ -z "$cleaned" ]; then
  echo 'strip-coauthor: refusing to empty the commit message' >&2
  exit 1
fi
tmp=$(mktemp)
hooks=$(mktemp -d)
printf '%s\n' "$cleaned" > "$tmp"
# hooksPath disables the platform hook, which would append the trailer again.
git -c core.hooksPath="$hooks" commit --amend -F "$tmp" >/dev/null
rm -rf "$tmp" "$hooks"
