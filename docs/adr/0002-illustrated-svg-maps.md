# ADR 0002: Illustrated SVG maps, not tiles

## Status

Accepted

## Context

The product needs maps that feel like a museum booklet and can show status, filters, and a quest route. Tile maps (Yandex, Leaflet, OSM tiles) already exist on competing sites and do not match the prototype.

## Decision

Maps are inline SVG drawn from preprojected geometry. The first map is the Konigsberg forts at `/map/kaliningrad`, ported from the static prototype (markers, filters, quest, bottom sheet). Coastline, rivers, and the city boundary come from OpenStreetMap under ODbL and are simplified. Object coordinates and prose keep their source links.

Other region slugs render a short "not drawn yet" page. A Yandex Maps deep link remains on each place for turn-by-turn navigation. That link is not an embedded tile map.

## Consequences

A new region needs new artwork and projected paths. It cannot be a drop-in of a slippy map. Pan and zoom are custom. The quest "I am here" control does not check geolocation. Route pages are the exception in ADR 0015: a lazy map of the ordered stops. This forts map stays SVG.
