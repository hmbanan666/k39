#!/usr/bin/env bash
# Fetch origin and fast-forward the current branch when that is a fast-forward.
# The fetch itself blocks until it finishes. A failed fetch fails this script.
# Local commits are left in place.
#
# Optional base ref: bash scripts/git/sync-branch.sh origin/main
# When the worktree is clean and HEAD is an ancestor of that ref (a branch cut
# from a stale main, with no commits of its own), fast-forward to the ref.
# A dirty worktree or a commit that is not in the ref blocks that reset.
set -euo pipefail

if [ "$#" -gt 1 ]; then
  echo 'sync-branch: usage: bash scripts/git/sync-branch.sh [base-ref]' >&2
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"
git fetch origin

base_ref="${1:-}"
base=""
if [ -n "$base_ref" ]; then
  if ! git rev-parse --verify --quiet "${base_ref}^{commit}" >/dev/null; then
    echo "sync-branch: base ref ${base_ref} does not resolve" >&2
    exit 1
  fi
  base=$(git rev-parse "${base_ref}^{commit}")
fi

dirty=0
if [ -n "$(git status --porcelain)" ]; then
  dirty=1
fi

branch=$(git symbolic-ref --quiet --short HEAD || true)
moved=0

if [ -z "$branch" ]; then
  if [ -n "$base_ref" ] && [ "$dirty" -eq 0 ] && git merge-base --is-ancestor HEAD "$base"; then
    if [ "$(git rev-parse HEAD)" != "$base" ]; then
      git checkout --detach "$base"
      echo "sync-branch: detached HEAD fast-forwarded to ${base_ref}"
    fi
    exit 0
  fi
  echo 'detached HEAD; fetched origin and left the checkout as it is' >&2
  exit 0
fi

if [ -n "$base_ref" ]; then
  if [ "$dirty" -eq 1 ]; then
    echo "sync-branch: worktree is dirty; not moving ${branch} to ${base_ref}" >&2
  elif git merge-base --is-ancestor HEAD "$base"; then
    if [ "$(git rev-parse HEAD)" != "$base" ]; then
      git merge --ff-only "$base"
      moved=1
      echo "sync-branch: fast-forwarded ${branch} to ${base_ref}"
    fi
  else
    echo "sync-branch: ${branch} has commits that are not in ${base_ref}; not moving it" >&2
  fi
fi

if ! git rev-parse --verify --quiet "refs/remotes/origin/${branch}" >/dev/null; then
  if [ "$moved" -eq 1 ]; then
    echo "origin/${branch} does not exist; fast-forwarded ${branch} to ${base_ref}"
  else
    echo "origin/${branch} does not exist; fetched and left ${branch} as it is" >&2
  fi
  exit 0
fi

remote="origin/${branch}"
if git merge-base --is-ancestor HEAD "$remote"; then
  if [ "$(git rev-parse HEAD)" != "$(git rev-parse "$remote")" ]; then
    git merge --ff-only "$remote"
    echo "fast-forwarded ${branch} to ${remote}"
  fi
else
  echo "${branch} has local commits; fetched and left it as it is" >&2
fi
