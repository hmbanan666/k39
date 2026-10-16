# Basemap archive

The visitor map (ADR 0019, the page in ADR 0037) uses a PMTiles extract of Kaliningrad oblast when the file on disk matches the expected sha256. Otherwise it uses OpenFreeMap. A missing or corrupt file does not break the map.

`GET /api/public/basemap` is the runtime choice. It is not a build-time `NUXT_PUBLIC_PMTILES_URL`. An empty `pmtilesUrl` is OpenFreeMap. `/basemap/kaliningrad.pmtiles` means the local archive verified. The response is `Cache-Control: no-store`, so a download that finishes after boot shows up on the next map load.

The 2026-10-13 extract is release `basemap-20261013`. It is 99,943,373 bytes (95.3 MiB). It is not part of the Docker image and not committed.

A desktop session that opens `/map` and then moves to Svetlogorsk at zoom 14 transferred 2,604,822 bytes of basemap responses: 2,059,202 bytes of PMTiles ranges, 545,547 bytes of glyphs, and 73 bytes of sprite. The oblast view before that jump was 2,487,825 bytes. The archive itself stays on disk. The browser only reads the header, directory, and the tiles in view.

## Startup download

On boot a background task checks `NUXT_BASEMAP_FILE` (default `/app/basemap/kaliningrad.pmtiles`). If the file is missing or its sha256 is not `BASEMAP_SHA256`, the process downloads `BASEMAP_SOURCE_URL`. The bytes go to a temporary file in the same directory (`kaliningrad.pmtiles.partial`). After the hash matches, that file is renamed onto the archive. The rename is atomic on the volume. The download does not block the server. Failed attempts retry with backoff. A lock file beside the archive (`kaliningrad.pmtiles.lock`) keeps a second process on the same volume from downloading at the same time. A stale lock is taken over. Failure is logged. The map stays on OpenFreeMap until a verified file is in place.

Defaults are in `apps/web-app/server/utils/basemap-defaults.ts`, `nuxt.config.ts`, and the image `ENV`. Dokploy does not need a new variable:

```text
BASEMAP_SOURCE_URL=https://github.com/hmbanan666/k39/releases/download/basemap-20261013/kaliningrad.pmtiles
BASEMAP_SHA256=fabf446a2a684639bea694470df268ace7bc48b4fec96e69881e2eb101f47472
```

`NUXT_BASEMAP_SOURCE_URL` and `NUXT_BASEMAP_SHA256` override the same values. `BASEMAP_SOURCE_URL` and `BASEMAP_SHA256` win when both are set.

Mount a writable directory at `/app/basemap` (uid 1000) so the file survives a redeploy. Without that volume the next boot downloads again into the image directory, which is empty after a new container. The image creates the directory.

The same-origin route serves the file with `Accept-Ranges: bytes`, status 206 for Range requests, and `Cache-Control: public, max-age=604800`. A direct request for a missing file is 404. The map is not given that URL unless the hash matches, so the 404 does not break the page. Glyphs and the sprite live in the image under `/basemap/fonts` and `/basemap/sprites` and are cached for a year.

Copying a file by hand still works. If its sha256 already matches, boot does not download.

## Object storage

An https `NUXT_PUBLIC_PMTILES_URL` is returned as-is and the startup download is skipped. A relative path in that variable is ignored.

```bash
NUXT_PUBLIC_PMTILES_URL=https://storage.example/k39/kaliningrad.pmtiles
```

The bucket should allow anonymous `GET` and `Range`, send `Accept-Ranges: bytes`, and allow the site origin in CORS (`Range`, `Content-Range`, `Accept-Ranges`). `NUXT_BASEMAP_FILE` is unused for the client URL in that case. An override that 404s does not fall back.

## Publish a new extract

There is no scheduled refresh. When the coast or a new road should appear:

1. Build the extract. `pmtiles` is the go-pmtiles CLI. `PMTILES_DATE` is the Protomaps daily build (UTC).

   ```bash
   PMTILES_DATE=YYYYMMDD ./scripts/basemap-extract.sh
   sha256sum basemap/kaliningrad.pmtiles > basemap/kaliningrad.pmtiles.sha256
   ```

   The script reads `https://build.protomaps.com/$PMTILES_DATE.pmtiles` over HTTP Range, keeps zoom 0–15 inside `19.6,54.3,22.95,55.35`, and writes `basemap/kaliningrad.pmtiles` (gitignored). Override the destination with `BASEMAP_OUT`. `sha256sum` writes `<hex>  kaliningrad.pmtiles`.

2. Publish a GitHub release, for example `basemap-YYYYMMDD`, and attach `kaliningrad.pmtiles` and `kaliningrad.pmtiles.sha256`.

3. Bump the defaults together and deploy:
   - `DEFAULT_BASEMAP_SOURCE_URL` and `DEFAULT_BASEMAP_SHA256` in `apps/web-app/server/utils/basemap-defaults.ts` (`nuxt.config.ts` imports them)
   - the matching `ENV` lines in `docker/web-app/Dockerfile`

Running containers download the new archive when the file on disk does not match the new hash. Browsers that already cached the old archive can keep it for up to seven days.

The daily build is the Protomaps basemap (schema version 4), not OpenMapTiles. The style in `@k39/map` follows that schema: `roads`, `places`, `landuse`, `water`, `buildings`, `boundaries`. Point of interest icons are omitted. The sprite at `/basemap/sprites/k39` is an empty placeholder so the style URL stays on this origin.

Attribution on the self-hosted map is OpenStreetMap contributors and Protomaps. The compact control is the `i` button.
