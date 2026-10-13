# ADR 0002: Illustrated SVG maps, not tiles

## Status

Superseded by ADR 0019. The forts booklet and its assets are removed.

## Context

The product needed maps that feel like a museum booklet and can show status, filters, and a quest route. Tile maps already existed on competing sites and did not match the prototype.

## Decision

The first map was inline SVG at `/map/forty`, drawn from preprojected geometry (markers, filters, quest, bottom sheet). That page, `FortsMap`, its geometry, and the booklet data are deleted. `/map/forty` is a normal 404. There is no redirect from `/map/forty` or from `/karta`.

The visitor map is `/map`, drawn by `@k39/map` (ADR 0019). Category SVG files under `public/illustrations/` stay. They are the card and hero fallback from `illustrationFor()`, not a map.

## Consequences

A new region does not need projected SVG artwork. Pan and zoom belong to the MapLibre visitor map. Yandex and Google links on a place or a route stay turn-by-turn directions, not an embedded tile map.
