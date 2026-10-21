#!/usr/bin/env bash
# Apply Drizzle migrations to the local dev database.
# .cursor/start.sh runs this after it creates `k39`, so the schema exists
# before the app boots. The Nitro plugin migrates again (idempotent) and is
# still the only step that imports initial content.
# Refuses a non-local host and a database name ending in _test.
set -euo pipefail
script_dir=${0%/*}
root=$(CDPATH= cd -- "${script_dir}/../.." && pwd)
cd "$root"

url=${DATABASE_URL:-postgres://k39:k39@127.0.0.1:5432/k39}

rest=$url
case "$rest" in
  *@*) rest=${rest#*@} ;;
  *://*) rest=${rest#*://} ;;
esac
host=${rest%%[:/]*}

case "$host" in
  localhost | 127.0.0.1) ;;
  *)
    echo "migrate-dev: refusing host ${host:-unknown} (only localhost and 127.0.0.1)" >&2
    exit 1
    ;;
esac

path_only=${url%%\?*}
name=${path_only##*/}
case "$name" in
  *_test)
    echo "migrate-dev: refusing database ${name} (the test suite migrates names ending in _test)" >&2
    exit 1
    ;;
  '' | *'/'*)
    echo "migrate-dev: database name missing in ${url}" >&2
    exit 1
    ;;
esac

export DATABASE_URL="$url"

if ! command -v corepack >/dev/null 2>&1; then
  echo 'migrate-dev: corepack is not on PATH' >&2
  exit 1
fi

exec corepack pnpm --filter @k39/database db:migrate
