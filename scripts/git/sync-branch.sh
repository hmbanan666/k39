#!/usr/bin/env bash
# Fetch origin and fast-forward the current branch when that is a fast-forward.
# The fetch itself blocks until it finishes. A failed fetch fails this script.
# Local commits are left in place.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

git fetch origin

branch=$(git symbolic-ref --quiet --short HEAD || true)
if [ -z "$branch" ]; then
  echo 'detached HEAD; fetched origin and left the checkout as it is' >&2
  exit 0
fi

if ! git rev-parse --verify --quiet "refs/remotes/origin/$branch" >/dev/null; then
  echo "origin/$branch does not exist; fetched and left $branch as it is" >&2
  exit 0
fi

if git merge-base --is-ancestor HEAD "origin/$branch"; then
  git merge --ff-only "origin/$branch"
  echo "fast-forwarded $branch to origin/$branch"
else
  echo "$branch has local commits; fetched and left it as it is" >&2
fi
