# ADR index

One record per number. The heading is `# ADR NNNN: Title`. CI rejects a duplicate number, a filename whose prefix does not match that heading, and any other first heading. A split record keeps the old filename as a redirect whose heading is `# Redirect: <filename>`.

Fetch `origin/main` before choosing a number. The next number is one higher than the highest record below. Land the ADR on `main` before the implementation PR. An open pull request does not reserve the number.

## Template

```markdown
# ADR NNNN: Title

## Status

Proposed.

## Context

## Decision

## Consequences
```

## Records

| Number | Record | Status |
| --- | --- | --- |
| 0001 | [Place copy in Nuxt Content, operations in Postgres](0001-content-and-postgres.md) | Superseded by ADR 0007 |
| 0002 | [Illustrated SVG maps, not tiles](0002-illustrated-svg-maps.md) | Superseded by ADR 0019 |
| 0003 | [Apply Drizzle migrations on startup](0003-migrate-on-startup.md) | Accepted |
| 0004 | [Consented anonymous events](0004-anonymous-events.md) | Accepted, partly superseded by ADR 0043 |
| 0005 | [Optional OAuth and apex redirect](0005-optional-oauth-and-apex-redirect.md) | Accepted |
| 0006 | [Corepack pnpm in the web image](0006-docker-pnpm.md) | Accepted |
| 0007 | [Content in Postgres, admin in this app](0007-postgres-content-admin.md) | Accepted |
| 0008 | [URLs, interlinking and crawlability](0008-urls-interlinking-seo.md) | Accepted |
| 0009 | [Hide the illustrated map behind a flag](0009-map-feature-flag.md) | Superseded |
| 0010 | [Reka UI and local CSS tokens](0010-design-system.md) | Accepted |
| 0011 | [Place photo pipeline](0011-media-pipeline.md) | Accepted |
| 0012 | [Content MCP](0012-content-mcp.md) | Accepted |
| 0013 | [First-party analytics](0013-first-party-analytics.md) | Accepted |
| 0014 | [Ordered stops and archive](0014-route-stops-and-archive.md) | Accepted |
| 0015 | [Phone map on route pages](0015-route-phone-map.md) | Accepted |
| 0016 | [Content scoring and page passports](0016-content-scoring.md) | Accepted |
| 0017 | [Geo offers, claim codes, and the business funnel](0017-geo-offers.md) | Accepted |
| 0018 | [Venues catalog](0018-venues-catalog.md) | Accepted |
| 0019 | [K39 map](0019-k39-map.md) | Accepted |
| 0020 | [Place guide template](0020-place-guide-template.md) | Accepted |
| 0021 | [Month guides as a collection kind](0021-month-guides.md) | Accepted |
| 0022 | [Reader navigation and the partner slot](0022-reader-partner-slot.md) | Accepted |
| 0023 | [Pages built from modules, with a chip picker](0023-module-pages.md) | Accepted |
| 0024 | [Visitor personas as an editorial tool](0024-personas.md) | Accepted |
| 0025 | [Static persona coverage](0025-persona-coverage.md) | Accepted |
| 0026 | [Visitor persona on the client](0026-visitor-persona.md) | Accepted |
| 0027 | [Place and route bodies as typed sections](0027-body-sections.md) | Accepted |
| 0028 | [One schedule primitive for every entity](0028-schedule.md) | Accepted |
| 0029 | [«Где поесть сейчас» hub](0029-eat-now-hub.md) | Accepted |
| 0030 | [Site search as a measured system](0030-site-search.md) | Accepted |
| 0031 | [Personal cabinet and venue claims](0031-cabinet-venue-claims.md) | Accepted |
| 0032 | [«Что заказать» is a showcase, not a menu](0032-dish-showcase.md) | Accepted |
| 0033 | [Typed shared facts as the core data layer](0033-typed-shared-facts.md) | Accepted |
| 0034 | [Earned length ceilings](0034-earned-length-ceilings.md) | Accepted |
| 0035 | [Draft content token](0035-draft-content-token.md) | Accepted |
| 0036 | [Guest submissions](0036-guest-content.md) | Accepted |
| 0037 | [Visitor map on MapLibre and OpenFreeMap](0037-visitor-map.md) | Accepted |
| 0038 | [Photos on collections](0038-collection-media.md) | Accepted |
| 0039 | [«Где дешевле»](0039-where-cheaper.md) | Accepted |
| 0040 | [Editor token moderates guest rows](0040-guest-mcp-moderation.md) | Accepted |
| 0041 | [Pending drafts for collections and routes](0041-collection-route-drafts.md) | Accepted |
| 0042 | [Opening hours with an unknown closing time](0042-open-ended-hours.md) | Accepted |
| 0043 | [Anonymous event rows are not a session](0043-anonymous-events-session.md) | Accepted |
| 0044 | [Weekdays with unknown hours](0044-schedule-unknown-days.md) | Accepted |
| 0045 | [Goal grace and the status check](0045-goal-grace-and-status-check.md) | Accepted |

## Redirects

Old filenames that stayed so existing links open:

- [0019-visitor-map.md](0019-visitor-map.md) moved to ADR 0037
- [0022-collection-media.md](0022-collection-media.md) moved to ADR 0038
- [0035-where-cheaper.md](0035-where-cheaper.md) moved to ADR 0039
