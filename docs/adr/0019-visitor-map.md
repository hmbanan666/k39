# ADR 0019: Visitor map on MapLibre and OpenFreeMap

## Status

Accepted.

## Context

ADR 0002 keeps the forts booklet as inline SVG at `/map/{region}`, behind `FEATURE_MAP`. ADR 0015 put a phone map on route pages: Leaflet and OpenStreetMap raster tiles, or Yandex Maps JS API 3 when a key was set, and a straight line through the stops. A straight line reads as a road and it is not one. The raster tiles also cannot take the paper, brick, and sea palette, and a full tourist map needs places, food, and one chosen route without drawing every route at once.

OpenFreeMap serves OpenMapTiles from OpenStreetMap with no key. MapLibre GL draws a vector style we own. The forts SVG stays the booklet. This record is the slippy map.

## Decision

`/karta` is the public map. It is in the footer, the header, and the sitemap. The title is `Карта Калининградской области | K39`. Filter query keys (`s`, `f`, `r`, `q`) are not tracking parameters, so `tuneRobots` marks those URLs `noindex`. The canonical stays `/karta`.

`@k39/map` is the reusable core. It has no Vue and no MapLibre. A host passes a scene: a style variant, a basemap, and layers in paint order (bottom to top). The only variant that ships is `paper` (muted land, soft water, thin roads, town names from `name:ru` then `name`, no POI). Another variant, such as a print sheet, is a new id in that module. It is not built here.

The layer API is three kinds:

- `points`. Each pin has an id, `[longitude, latitude]`, a marker name the host has registered as an image, and a card. `sponsored: true` draws the amber partner dot. `cluster: true` groups nearby pins. The visitor map turns sponsored on only when `FEATURE_SPONSORED_VENUES` is on and the venue has an active offer.
- `line`. A list of `[longitude, latitude]`. `dashed: true` means the stroke is stop order, not a road. Fewer than two positions draws nothing.
- `stops`. Numbered markers. `n` is the label. Each stop has a card.

Layer ids match `^[a-z][a-z0-9-]{0,40}$` and are unique in one scene. `cardFor(layers, id)` is the card for a selected pin or stop. `mapStyle(variant, basemap)` builds the MapLibre style. An empty `pmtilesUrl` is the OpenFreeMap fallback. A set URL is the PMTiles source.

The web app mounts that scene in `mountK39Map`. `/karta`, the venue frame, and the route frame are callers. A later guide, quest, or offline sheet builds its own layers and, if it needs a different look, its own variant. It should not fork the basemap or the pin renderer.

The paper basemap omits POI, housenumbers, shields, and one-way arrows.

`GET /api/public/basemap` chooses the source at runtime. When the file at `NUXT_BASEMAP_FILE` exists and its sha256 equals `BASEMAP_SHA256`, the response is `/basemap/kaliningrad.pmtiles`. MapLibre reads it with the `pmtiles` protocol (HTTP Range). The style follows the Protomaps basemap schema (`roads`, `places`, `landuse`, `water`, `buildings`, `boundaries`), not OpenMapTiles. Glyphs are Noto Sans files under `/basemap/fonts`. The sprite URL is `/basemap/sprites/k39` and the sprite is empty because the style draws no basemap icons. Attribution is OpenStreetMap contributors and Protomaps. The control stays MapLibre's compact `i` button.

The 2026-10-13 archive is 99,943,373 bytes. It is not in git and not in the image. `NUXT_BASEMAP_FILE` (image default `/app/basemap/kaliningrad.pmtiles`) is a volume file. On boot a background task downloads `BASEMAP_SOURCE_URL` when the file is missing or the hash does not match, writes a temporary file in that directory, checks the hash, and renames it into place. Defaults are baked into the image, so the host does not need a new variable. The route `/basemap/kaliningrad.pmtiles` answers Range with 206 and caches for seven days. An https `NUXT_PUBLIC_PMTILES_URL` is an object-storage override and skips the download. That bucket must allow Range. A relative value is ignored. Publish steps are in `docs/basemap.md`. `scripts/basemap-extract.sh` rebuilds the file. There is no schedule.

When the archive is missing or the hash does not match, `pmtilesUrl` is empty. The style uses the OpenFreeMap TileJSON `https://tiles.openfreemap.org/planet` (OpenMapTiles) and remote glyphs. The wildcard `/{z}/{x}/{y}.pbf` path answers with empty tiles, so that fallback does not use it. A missing local file does not break the map. An https override that 404s does not fall back.

Pins are canvas images, one per sight facet and food kind: форты, замки, пляжи, музеи, церкви, курорты, and the food kinds. Churches are places whose slug or title matches собор, кирха, or церковь. The cathedral stays in the museum category and also matches the church chip. Clusters are cream bubbles with a brick stroke and a count. Hover and the selected pin scale up. A partner dot is drawn only when `FEATURE_SPONSORED_VENUES` is on and the venue has an active offer.

The card has one action, «Открыть». «Как добраться» stays on the place and route pages. The card closes on a map tap, Escape, or a downward swipe. The close control is an icon. The photo is a thumbnail on a wide screen and a short strip on a phone, where the card is a bottom sheet.

`/karta` fills `100dvh` minus the header. Filters, search, and the route picker float over the map. On a phone the result list is behind «Список». Choices live in the query: `s` for sight ids (`none` clears them), `f` for food path segments such as `kofe`, `r` for one route slug, `q` for the name. Omitting `s` or `f` means all of that group.

Routes draw nothing until `r` is set. The selected route shows numbered stops. `routes.path` is an optional list of `[longitude, latitude]`. When that line has at least two points, the map draws it solid. Otherwise the stops are joined in order with a dashed stroke, which is not a road. The same rule is used on `/marshruty/{slug}`. The Yandex and Google direction links on that page are unchanged. `route_draft_create`, `route_draft_update`, and `route_update` accept `path`. Omit it to keep the stored line. Null clears it.

The library loads in a separate chunk: on `/karta` after mount, and on an embedded map after `load`, idle, and an intersection observer, as in ADR 0015. Embedded maps use cooperative gestures so the page can still scroll, and they can go fullscreen. «Я здесь» asks the browser for a one-off location and does not store it. A venue card dispatches the existing cookieless `impression` beacon. `FEATURE_MAP` still governs only `/map/{region}`.

## Consequences

When the verified archive is served, tile bytes stay on our origin or the bucket. Otherwise they go to OpenFreeMap. There is no Yandex or Leaflet script on the map. `NUXT_PUBLIC_YANDEX_MAPS_API_KEY` no longer chooses a basemap. A route with no stored path never pretends to be a road. Replacing the PMTiles file can take up to seven days to show up in a browser that already cached the archive. The forts booklet is still ADR 0002.
