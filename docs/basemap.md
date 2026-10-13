# Basemap archive

The visitor map (ADR 0019) prefers a PMTiles file of Kaliningrad oblast. OpenFreeMap is the fallback when `NUXT_PUBLIC_PMTILES_URL` is empty.

The 2026-10-13 extract is 99,943,373 bytes (95.3 MiB). It is not part of the Docker image and not committed. Put it on a volume or in object storage.

A desktop session that opens `/karta` and then moves to Svetlogorsk at zoom 14 transferred 2,604,822 bytes of basemap responses: 2,059,202 bytes of PMTiles ranges, 545,547 bytes of glyphs, and 73 bytes of sprite. The oblast view before that jump was 2,487,825 bytes. The archive itself stays on disk. The browser only reads the header, directory, and the tiles in view.

## Volume on the app

Dokploy (or any host) mounts a directory at `/app/basemap`. The image creates that directory and sets `NUXT_BASEMAP_FILE=/app/basemap/kaliningrad.pmtiles`. The process user is uid 1000.

```bash
cp basemap/kaliningrad.pmtiles /path/on/host/basemap/kaliningrad.pmtiles
```

Set:

```bash
NUXT_PUBLIC_PMTILES_URL=/basemap/kaliningrad.pmtiles
NUXT_BASEMAP_FILE=/app/basemap/kaliningrad.pmtiles
```

The app serves that file at `/basemap/kaliningrad.pmtiles` with `Accept-Ranges: bytes`, status 206 for Range requests, and `Cache-Control: public, max-age=604800`. A replaced file can stay cached for up to seven days. Glyphs and the sprite live in the image under `/basemap/fonts` and `/basemap/sprites` and are cached for a year.

A missing file is 404. The map does not fall back to OpenFreeMap when the URL is set and the file is absent.

## Object storage

Upload the same file to a bucket that allows anonymous `GET` and `Range`. Allow the site origin in CORS (`Range`, `Content-Range`, `Accept-Ranges`). Set:

```bash
NUXT_PUBLIC_PMTILES_URL=https://storage.example/k39/kaliningrad.pmtiles
```

`NUXT_BASEMAP_FILE` is unused in that case. The bucket should send a long cache lifetime and `Accept-Ranges: bytes`.

## Rebuild

There is no scheduled refresh. When the coast or a new road should appear, extract again and replace the file.

```bash
# pmtiles is the go-pmtiles CLI. PMTILES_DATE is the Protomaps daily build (UTC).
PMTILES_DATE=20261013 ./scripts/basemap-extract.sh
```

The script reads `https://build.protomaps.com/$PMTILES_DATE.pmtiles` over HTTP Range, keeps zoom 0–15 inside `19.6,54.3,22.95,55.35`, and writes `basemap/kaliningrad.pmtiles` (gitignored). Override the destination with `BASEMAP_OUT`.

The daily build is the Protomaps basemap (schema version 4), not OpenMapTiles. The style in `shared/map-style.ts` follows that schema: `roads`, `places`, `landuse`, `water`, `buildings`, `boundaries`. Point of interest icons are omitted. The sprite at `/basemap/sprites/k39` is an empty placeholder so the style URL stays on this origin.

Attribution on the self-hosted map is OpenStreetMap contributors and Protomaps. The compact control is the `i` button.
