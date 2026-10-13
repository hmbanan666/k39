#!/usr/bin/env bash
# Rebuild the Kaliningrad oblast vector archive. Manual. See docs/basemap.md.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
date="${PMTILES_DATE:-$(date -u +%Y%m%d)}"
source="${PMTILES_SOURCE:-https://build.protomaps.com/${date}.pmtiles}"
bbox="${BBOX:-19.6,54.3,22.95,55.35}"
maxzoom="${MAXZOOM:-15}"
out="${BASEMAP_OUT:-${root}/basemap/kaliningrad.pmtiles}"
bin="${PMTILES_BIN:-pmtiles}"

if ! command -v "$bin" >/dev/null 2>&1; then
  echo "pmtiles CLI not found. Install go-pmtiles and set PMTILES_BIN, or put pmtiles on PATH." >&2
  echo "https://github.com/protomaps/go-pmtiles/releases" >&2
  exit 1
fi

mkdir -p "$(dirname "$out")"
tmp="${out}.partial"
rm -f "$tmp"
echo "extract ${source}"
echo "bbox ${bbox} maxzoom ${maxzoom}"
echo "out ${out}"
"$bin" extract "$source" "$tmp" --bbox="$bbox" --maxzoom="$maxzoom" --download-threads="${DOWNLOAD_THREADS:-8}"
mv "$tmp" "$out"
"$bin" show "$out" | head -n 20
ls -lh "$out"
echo "Copy ${out} to the basemap volume (NUXT_BASEMAP_FILE) or to object storage, then set NUXT_PUBLIC_PMTILES_URL."
