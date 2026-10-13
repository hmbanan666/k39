# ADR 0009: Hide the illustrated map behind a flag

## Status

Superseded. The flag and the forts booklet are removed. See ADR 0002 and ADR 0019.

## Context

The forts map component was a large client-side SVG. It was not ready to be a primary crawl target, so it lived at `/map/forty` behind `FEATURE_MAP`.

## Decision

`FEATURE_MAP` is gone, including `.env.example`, the public flags endpoint, and the unused `mapEnabled` argument on redirects. `/map` is the only map. `/map/forty` is a normal 404 and is not in the sitemap. Nothing redirects `/map/forty` or `/karta`.

## Consequences

There is no flag to turn the booklet back on. Serving that page again would be a new page, not a revival of `FortsMap`.
