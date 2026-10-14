# ADR 0029: «Где поесть сейчас» hub

Status: accepted

## Context

People ask «где поесть сейчас» in a town. ADR 0018 lists venues and ADR 0028
computes «открыто сейчас» in the browser so cached HTML never lies. A page
whose order depends on the current status needs both.

## Decision

- `/gde-poest-seychas` lists towns that have published food venues;
  `/gde-poest-seychas/{region}` lists every published food venue of the town.
- The server renders the full list, sorted by straight-line distance from the
  region centre (or the venues' centroid when the region has none). Search
  engines and people get the same venues, names, links, kitchen and prices.
- After hydration the browser computes each status from the schedule rules
  and regroups the same items into «Открыто сейчас», «Откроется позже» and
  «Часы не проверены», distance order inside each group. It refreshes every
  minute. Unverified schedules are never «open».
- «Ближе ко мне» asks for geolocation only on click and re-sorts locally.
  The position never leaves the browser.
- Title and description are written for the query; the page is in the
  sitemap. Linked from /eda and from every «Где поесть рядом» block (city
  pages included) via the nearest venue's region.

## Consequences

- No status in server HTML, so no stale «открыто» in caches.
- Before hydration the list is one block; grouping appears a moment later.
