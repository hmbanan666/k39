# ADR 0051: Regions are named catalogue areas

## Status

Accepted (2026-10-24). This records the decision for [issue 304](https://github.com/hmbanan666/k39/issues/304), not its implementation or deployed acceptance. It clarifies the geographic meaning of region-backed groups in [ADR 0018](0018-venues-catalog.md), [ADR 0029](0029-eat-now-hub.md), [ADR 0030](0030-site-search.md) and [ADR 0039](0039-where-cheaper.md). Their grouping, URL and eligibility decisions remain.

## Context

The current `regions` row supplies a stable ID and slug, titles and an optional map centre. Places and venues reference it; venues also have a full address and coordinates. There is no separate verified settlement field. The same membership drives catalogue filters, search, price samples and regional food pages.

At baseline `0875fcb`, `regionLabel` prefers `shortTitle`, whose schema and tool descriptions call it a town name. Other helpers inflect known region slugs as cities. Venue and place SEO also pass a region title into JSON-LD `addressLocality`. Issue 304 reports a venue and a town page whose region anchor differs from their own settlement. Membership alone cannot establish a city address, a city-only comparison sample or a legal municipal boundary.

## Decision

### Area, anchor and locality have different meanings

A **catalogue area** is the named search and discovery group represented by an existing region ID. It may include an anchor city and surrounding settlements. The **anchor** is a familiar name used to find that area; it is not a containment assertion. A **locality** is an independently verified settlement of a particular subject. Area membership, a map centre and a subject's coordinates are not locality evidence.

Keep `regions`, `regionId`, `regionSlug`, IDs, slugs and existing memberships. No new settlement table, taxonomy, polygon, geocoder or migration is required for this correction. Do not relabel areas as legal districts or assert current municipal names or statuses. Existing stored titles can remain historical editorial data; they do not certify legal geography.

### One area presentation contract

Use a shared area presentation contract for generated public labels and their grammatical forms. Known anchors use explicit area wording, for example «Зеленоградск и окрестности», «в Зеленоградске и окрестностях» and «по Зеленоградску и окрестностям». Custom names need neutral catalogue wording rather than guessed city declension or administrative status; missing names remain unknown. Do not append a second qualifier to an already explicit area label.

Apply this meaning consistently to generated venue titles and descriptions, place/venue eyebrows and cards, breadcrumbs, listing and food-page headings, search labels, price comparisons, comparison summaries and their accessibility text. A price sample is the existing area's eligible venues, so its description must say area rather than city. Region-backed search kind `city` and similar internal names may remain for wire compatibility, but reader-facing language must describe an area. A town page keeps its own subject name and H1; its area label must not rename it after the anchor.

Admin labels, MCP descriptions and schema comments must explain «территория каталога», including that membership does not verify locality. Preserve existing field names, payload shapes, region-list results and writer/access behaviour. `shortTitle` remains an optional display input, not a new settlement assertion; do not require editors to rewrite stored regions to fix generated copy.

### Addresses and structured data

Preserve verified full addresses and coordinates. Never split free-form address text, inspect a slug/title or infer a settlement from an area or pin to fill `addressLocality`. The current region-only model cannot provide that field, so omit it unless an independently verified locality is available through an explicit data contract. Area wording belongs in navigation and descriptions, not in `addressLocality`. Keep the full address in `streetAddress`; known country/oblast fields remain separate. If no usable address fields remain, omit the address object rather than inventing one.

Visible SSR breadcrumbs and their JSON-LD must agree. Preserve the authored SEO override contract from [ADR 0008](0008-urls-interlinking-seo.md); this decision corrects generated output, not stored article text or verified addresses. Unsupported location claims in authored content require a separate source-backed editorial correction, not automatic replacement.

### Compatibility and search

Keep canonical paths, links, redirects, sitemap and noindex thresholds, search membership and anchor-name discoverability. Keep comparison peers, counts, bands, freshness/source rules and coverage thresholds. This is an accurate description of the existing sample, not a promise of a settlement-specific market comparison.

Keep subject coordinates, region map centres, centre/centroid selection, distance origins and ordering. Area membership does not establish a compact walkable city or a route distance; this decision does not change routing or scoring algorithms. Generated title/snippet wording will change, but there is no URL migration or reason to discard existing search identity.

## Consequences

The bounded correction removes unsupported city claims while retaining catalogue coverage. It does not answer settlement-only filtering or comparison questions. A dedicated settlement model would require verified data, ownership and migration decisions beyond this scope. Legal district renaming and address parsing would add unsupported claims; changing one reported venue would leave the shared defect in place.

Implementation acceptance must cover subjects in different settlements sharing an area, a town subject whose name differs from the anchor, known/custom/missing labels and existing explicit area names. Verify generated headings, comparisons, search, SSR and JSON-LD together; an unknown locality must stay absent while the full address survives. Existing URLs, memberships, counts, price thresholds and distance origins must remain stable. Staff/tool round trips retain their existing payload and permission contracts. A UI implementation needs the repository's genuine mobile/desktop before/after evidence.

This ADR changes no runtime, content or production configuration and does not close issue 304. Implementation follows only after this record lands on main. Presentation can be rolled back without data repair; reverting to city-only labels would restore the inaccurate claim, so any rollback needs equally truthful wording.
