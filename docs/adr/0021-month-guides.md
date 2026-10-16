# ADR 0021: Month guides as a collection kind

## Status

Accepted

## Context

We want twelve guides, one per month, that describe the region in that month and link to our places.
They need a body, an ordered list of places, a map and a separate Sources list.
Article bodies carry no external links, so sources must live outside the body.

## Decision

Month guides are collections with `kind = 'month'` and `month` 1..12. Plain collections keep `kind = 'theme'`.
Collections gain a `sources` jsonb list, rendered in a collapsed Sources block like on place pages.
A partial unique index allows one guide per month.
URLs stay under `/podborki/<slug>`, so the sitemap, redirects and the editor need no change.
The index lists month guides in calendar order above themed collections, and each guide links the other months.
`collection_save` accepts `kind`, `month` and `sources`.

## Consequences

No new page type or route. A dedicated section can be added later with a 301 from the current slugs.
