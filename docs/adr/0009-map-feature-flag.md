# ADR 0009: Hide the illustrated map behind a flag

## Status

Accepted. Narrows ADR 0002.

## Context

The forts map component is large client-side SVG. It is not ready to be a primary crawl target, and the public information architecture is now hubs and place pages.

## Decision

`FortsMap` stays in the repo at `/map/forty`. Nothing in the header, footer or sitemap links to it. `robots.txt` disallows `/map/`. The visitor map at `/map` is public and is not behind the flag. With the flag off, `/map/forty` answers 404. With the flag on, it renders the booklet and sends `noindex`. There is no redirect from `/map` or from older booklet paths.

## Consequences

Turning the flag on changes the 404 into a 200. Do that only when the booklet should be reachable again, and keep it out of the sitemap until it is meant to be indexed.
