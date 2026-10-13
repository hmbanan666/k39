# ADR 0019: Visitor map on MapLibre and OpenFreeMap

## Status

Accepted.

## Context

ADR 0002 keeps the forts booklet as inline SVG at `/map/{region}`, behind `FEATURE_MAP`. ADR 0015 put a phone map on route pages: Leaflet and OpenStreetMap raster tiles, or Yandex Maps JS API 3 when a key was set, and a straight line through the stops. A straight line reads as a road and it is not one. The raster tiles also cannot take the paper, brick, and sea palette, and a full tourist map needs places, food, and one chosen route without drawing every route at once.

OpenFreeMap serves OpenMapTiles from OpenStreetMap with no key. MapLibre GL draws a vector style we own. The forts SVG stays the booklet. This record is the slippy map.

## Decision

`/karta` is the public map. It is in the footer, the header, and the sitemap. The title is `Карта Калининградской области | K39`. Filter query keys (`s`, `f`, `r`, `q`) are not tracking parameters, so `tuneRobots` marks those URLs `noindex`. The canonical stays `/karta`.

The basemap is a MapLibre style in `shared/map-style.ts`. Land is the paper tone, water is a soft grey-blue, roads stay thin, and town labels use `name:ru` then `name`. POI, housenumbers, shields, and one-way arrows are omitted. The vector source is the OpenFreeMap TileJSON `https://tiles.openfreemap.org/planet`. The wildcard `/{z}/{x}/{y}.pbf` path answers with empty tiles, so the style does not use it. The style source attribution links OpenFreeMap, OpenMapTiles, and OpenStreetMap. The control is MapLibre's compact attribution, collapsed to an `i` button.

Pins are canvas images, one per sight facet and food kind: форты, замки, пляжи, музеи, церкви, курорты, and the food kinds. Churches are places whose slug or title matches собор, кирха, or церковь. The cathedral stays in the museum category and also matches the church chip. Clusters are cream bubbles with a brick stroke and a count. Hover and the selected pin scale up. A partner dot is drawn only when `FEATURE_SPONSORED_VENUES` is on and the venue has an active offer.

The card has one action, «Открыть». «Как добраться» stays on the place and route pages. The card closes on a map tap, Escape, or a downward swipe. The close control is an icon. The photo is a thumbnail on a wide screen and a short strip on a phone, where the card is a bottom sheet.

`/karta` fills `100dvh` minus the header. Filters, search, and the route picker float over the map. On a phone the result list is behind «Список». Choices live in the query: `s` for sight ids (`none` clears them), `f` for food path segments such as `kofe`, `r` for one route slug, `q` for the name. Omitting `s` or `f` means all of that group.

Routes draw nothing until `r` is set. The selected route shows numbered stops. `routes.path` is an optional list of `[longitude, latitude]`. When that line has at least two points, the map draws it solid. Otherwise the stops are joined in order with a dashed stroke, which is not a road. The same rule is used on `/marshruty/{slug}`. The Yandex and Google direction links on that page are unchanged. `route_draft_create`, `route_draft_update`, and `route_update` accept `path`. Omit it to keep the stored line. Null clears it.

The library loads in a separate chunk: on `/karta` after mount, and on an embedded map after `load`, idle, and an intersection observer, as in ADR 0015. Embedded maps use cooperative gestures so the page can still scroll, and they can go fullscreen. «Я здесь» asks the browser for a one-off location and does not store it. A venue card dispatches the existing cookieless `impression` beacon. `FEATURE_MAP` still governs only `/map/{region}`.

## Consequences

Visitors' tile requests go to OpenFreeMap. There is no Yandex or Leaflet script on the map. `NUXT_PUBLIC_YANDEX_MAPS_API_KEY` no longer chooses a basemap. A route with no stored path never pretends to be a road. The forts booklet is still ADR 0002.
