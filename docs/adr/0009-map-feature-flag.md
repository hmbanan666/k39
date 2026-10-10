# ADR 0009: Hide the illustrated map behind a flag

## Status

Accepted. Narrows ADR 0002.

## Context

The forts map component is large client-side SVG. It is not ready to be a primary crawl target, and the public information architecture is now hubs and place pages.

## Decision

`FortsMap` stays in the repo. Nothing in the header, footer or sitemap links to it. `robots.txt` disallows `/map`. Requests to `/map` and `/map/*` answer 301 to `/forty` unless `FEATURE_MAP=true`. With the flag on, `/map/{region}` renders the component and sends `noindex`.

## Consequences

Turning the flag on changes a redirect into a 200. Do that only when the map should be reachable again, and keep it out of the sitemap until it is meant to be indexed.
