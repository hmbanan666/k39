#!/usr/bin/env bash
# Fail when the committed Cloud Agent image did not come up.
# Prints every miss, then exits non-zero. Agents can run this by hand.
# .cursor/start.sh runs it after Node, git, and Postgres setup.
set -u
script_dir=${0%/*}
root=$(CDPATH= cd -- "${script_dir}/../.." && pwd)
cd "$root"

want=$(< .nvmrc)
want=${want//[[:space:]]/}
profile=${K39_BOOT_PROFILE:-/etc/profile.d/k39.sh}
missing=()

if ! command -v node >/dev/null 2>&1; then
  missing+=("node: not on PATH (want v${want} from .nvmrc)")
else
  got=$(node -v 2>/dev/null || true)
  where=$(command -v node)
  if [ "$got" != "v${want}" ]; then
    missing+=("node: ${where} is ${got:-unknown}; want v${want} from .nvmrc")
  fi
fi

if ! command -v pg_isready >/dev/null 2>&1; then
  missing+=("postgres: pg_isready is not on PATH (want Postgres 18 on 127.0.0.1:5432)")
elif ! pg_isready -h 127.0.0.1 -q; then
  missing+=("postgres: not accepting connections on 127.0.0.1:5432")
else
  if command -v pg_lsclusters >/dev/null 2>&1; then
    online=""
    cluster_major=""
    while read -r ver _name _port status _; do
      [ -n "${ver:-}" ] || continue
      if [ "$status" = online ]; then
        online="${online:+${online},}${ver}"
        case "$ver" in
          18 | 18.*) cluster_major=18 ;;
        esac
      fi
    done < <(pg_lsclusters --no-header || true)
    if [ "$cluster_major" != 18 ]; then
      missing+=("postgres: online cluster is ${online:-none}; want 18")
    fi
  elif command -v psql >/dev/null 2>&1; then
    major=""
    url=${DATABASE_URL:-postgres://k39:k39@127.0.0.1:5432/k39}
    num=$(psql "$url" -tAc 'show server_version_num' 2>/dev/null || true)
    num=${num//[[:space:]]/}
    if [ -n "$num" ]; then
      major=$((num / 10000))
    fi
    if [ "$major" != "18" ]; then
      missing+=("postgres: server version is ${major:-unknown}; want 18")
    fi
  else
    missing+=("postgres: accepting connections but the version is unknown (no pg_lsclusters or psql); want 18")
  fi
fi

if [ ! -e "$profile" ]; then
  missing+=("profile: ${profile} is missing (.cursor/Dockerfile writes /etc/profile.d/k39.sh)")
elif [ ! -s "$profile" ]; then
  missing+=("profile: ${profile} is empty (.cursor/Dockerfile writes /etc/profile.d/k39.sh)")
fi

if [ "${#missing[@]}" -gt 0 ]; then
  echo 'boot check failed:'
  for line in "${missing[@]}"; do
    echo "$line"
  done
  exit 1
fi

echo "boot check passed: node v${want}, postgres 18, ${profile}"
