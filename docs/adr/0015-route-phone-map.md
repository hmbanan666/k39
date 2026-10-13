# ADR 0015: Phone map on route pages

## Status

Accepted. The embedded basemap in this record is superseded by ADR 0019. Direction links on the route page stay here.

## Context

A route page listed its stops as names. On a phone that is not enough: the visitor needs the stops in geographic order, a straight-line sense of the next leg, and a way to open turn-by-turn navigation. ADR 0002 still draws the forts booklet at `/map/{region}` as inline SVG and keeps that map behind `FEATURE_MAP`. A route such as the east castles spans tens of kilometres, so a schematic with no basemap is hard to read on a small screen.

Yandex Maps JS API 3 matches the maps Russian visitors already use, and it needs an API key that is not a required production variable. MapLibre GL is a WebGL bundle built for custom vector styles. A single static image cannot be panned or pinched.

## Decision

The route page (`/marshruty/{slug}`) draws one polyline through the published stops that have coordinates, in stop order, with a numbered marker for each. Marker numbers are the route positions, not a renumbering of the points that happen to have coordinates.

The frame is the compact `@k39/map` embed (ADR 0019): the paper basemap, the round category pins, places and venues within 1.2 km, fullscreen, and «Открыть на карте». `NUXT_PUBLIC_YANDEX_MAPS_API_KEY` does not choose the basemap. The forts SVG booklet is unchanged.

The map is not in the server HTML. The frame has a fixed height, so the later canvas does not push the stops. The browser loads the library only after the window `load` event, then `requestIdleCallback`, then an `IntersectionObserver` with a 120px root margin. Tile images are therefore absent from the first document, and the `h1` stays the LCP text. Until the map is ready, and if it never loads, the frame shows an ordered list of stop links.

Stop cards under the map are server-rendered. Each card shows the stop note when one is stored, the straight-line distance to the next stop, and a link to the place. Distance is haversine kilometres. The label always starts with «около», including legs of a kilometre or more, because the line is not the road. The last stop has no leg. A stop with no coordinates has no leg and is left out of the line and the external links.

«Построить маршрут в Яндекс Картах» points at `https://yandex.ru/maps/?rtext=lat,lon~lat,lon~...&rtt=auto`. Yandex `rtext` is latitude then longitude. A Reka radio group sets `rtt` to `auto` (на машине), `pd` (пешком), or `mt` (транспорт). «В Google Maps» is the Directions URL with `travelmode` `driving`, `walking`, or `transit` for the same choice. Both are anchors with `target="_blank"` and `nofollow`. The links need two coordinates and work without the embedded map. On a coarse pointer the embed uses cooperative gestures, so a one-finger swipe still scrolls the page. Scroll-wheel zoom stays off.

`TouristTrip.itinerary` is an `ItemList` of the ordered places. Each entry's `item` is a `TouristAttraction` with `geo` when the place has coordinates. The stop note stays on the `ListItem` `description`.

OSM's public tile servers are not a production CDN. Replacing the tile URL does not change the page. Attribution stays.

## Consequences

An empty key keeps the Yandex script off the page. The map library loads only when the frame is near the viewport. Tile requests follow ADR 0019. The dormant consent banner does not gate that request. ADR 0002 still governs `/map/{region}`.
