#!/usr/bin/env bash
# Runs on every agent boot. Node on PATH, a fetched branch, then Postgres.
# The platform does not wait for this script. Agents also run
# scripts/git/sync-branch.sh before editing. See AGENTS.md.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

bash scripts/env/node-path.sh
bash scripts/git/sync-branch.sh

if command -v pg_lsclusters >/dev/null 2>&1; then
  if ! pg_lsclusters --no-header | awk '{print $1,$2}' | grep -qx '18 main'; then
    sudo pg_createcluster 18 main
  fi
  if ! pg_lsclusters --no-header | awk '$1=="18" && $2=="main" {print $4}' | grep -qx online; then
    sudo pg_ctlcluster 18 main start
  fi
fi

ready=0
for _ in $(seq 1 30); do
  if pg_isready -h 127.0.0.1 -q; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo 'Postgres did not become ready on 127.0.0.1:5432' >&2
  exit 1
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -tc "select 1 from pg_roles where rolname='k39'" | grep -q 1 \
  || sudo -u postgres psql -v ON_ERROR_STOP=1 -c "create role k39 login password 'k39' superuser"
sudo -u postgres psql -v ON_ERROR_STOP=1 -tc "select 1 from pg_database where datname='k39'" | grep -q 1 \
  || sudo -u postgres psql -v ON_ERROR_STOP=1 -c "create database k39 owner k39"
sudo -u postgres psql -v ON_ERROR_STOP=1 -tc "select 1 from pg_database where datname='k39_test'" | grep -q 1 \
  || sudo -u postgres psql -v ON_ERROR_STOP=1 -c "create database k39_test owner k39"

install -m 0755 scripts/git/post-commit .git/hooks/post-commit
node scripts/git/chain-hooks.mjs
