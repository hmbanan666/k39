#!/usr/bin/env bash
# Boot a copy of the Nitro output outside the repo and request a few SSR pages.
# Node resolves modules by walking parent directories, so running inside the
# workspace would hide a missing dependency that the Docker image does not have.
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
source="${1:-$root/apps/web-app/.output}"
if [[ ! -f "$source/server/index.mjs" ]]; then
  echo "Nitro output is missing at $source. Run pnpm --filter @k39/web-app build first."
  exit 1
fi

dest="$(mktemp -d)"
cleanup() {
  if [[ -n "${pid:-}" ]]; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  rm -rf "$dest"
}
trap cleanup EXIT

cp -a "$source/." "$dest/"
if grep -R -q --include='*.mjs' '/@nuxt/icon/node_modules/@iconify/utils' "$dest/server"; then
  echo 'Server bundle still imports @iconify/utils from a nested path that is not shipped.'
  exit 1
fi

port="${SMOKE_PORT:-3456}"
export NODE_ENV=production
export HOST=127.0.0.1
export PORT="$port"
export DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
export NUXT_SESSION_PASSWORD="${NUXT_SESSION_PASSWORD:-smoke-test-session-password-32chars}"
export MIGRATIONS_FOLDER="${MIGRATIONS_FOLDER:-$root/packages/database/migrations}"
export MEDIA_DIR="${MEDIA_DIR:-$dest/media}"
mkdir -p "$MEDIA_DIR"

cd "$dest"
node server/index.mjs >"$dest/server.log" 2>&1 &
pid=$!

base="http://127.0.0.1:$port"
ready=0
for _ in $(seq 1 90); do
  if curl -sf -o /dev/null "$base/api/health"; then
    ready=1
    break
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    echo 'Server exited before it was ready'
    cat "$dest/server.log"
    exit 1
  fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then
  echo 'Server did not become ready'
  cat "$dest/server.log"
  exit 1
fi

fail=0
check() {
  local path="$1" expect="$2" needle="${3:-}"
  local code
  code="$(curl -sS -o "$dest/body" -D "$dest/headers" -w '%{http_code}' --max-redirs 0 "$base$path" || true)"
  echo "$path -> $code (want $expect)"
  if [[ "$code" != "$expect" ]]; then
    echo '--- headers ---'
    cat "$dest/headers"
    echo '--- body ---'
    head -c 600 "$dest/body" || true
    echo
    fail=1
    return
  fi
  if grep -qi '^location:' "$dest/headers"; then
    echo "unexpected redirect on $path"
    cat "$dest/headers"
    fail=1
  fi
  if [[ -n "$needle" ]] && ! grep -q "$needle" "$dest/body"; then
    echo "missing '$needle' on $path"
    fail=1
  fi
  if grep -q 'Cannot find module' "$dest/body"; then
    echo "module error on $path"
    head -c 600 "$dest/body" || true
    echo
    fail=1
  fi
}

check /fort-11-denhoff 200 'Форт'
check /forty 200
check /zavedeniya 200
check /map 200 'Карта Калининградской области'
check /map/forty 404
check /karta 404

if [[ "$fail" != 0 ]]; then
  echo '--- server log ---'
  tail -n 120 "$dest/server.log"
  exit 1
fi
