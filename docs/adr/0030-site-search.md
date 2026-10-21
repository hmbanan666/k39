# ADR 0030: Site search as a measured system

## Status

Accepted.

## Context

K39 has no public search. A visitor who does not find a place in the menus leaves, and we never learn what they wanted. Search is also the cheapest source of demand data we own: the words people type on our site are what they want from a Kaliningrad guide, in their own spelling. ADR 0013 already gives us cookieless sessions, channels, and the queries Google Search Console (and later Yandex Webmaster) sent to us. Site search should plug into that, not stand beside it.

The catalog is small (about 80 places, 30 venues, a few routes, collections and quests). It is Russian, with German place names in two or three spellings (Кёнигсберг, Кенигсберг, Königsberg) and visitors who type on the wrong keyboard layout.

## Decision

### Engine

Postgres full-text search with the `russian` configuration, plus `pg_trgm` for typos. No external search service: Meilisearch, Typesense, Algolia and Elastic would add a second store to keep in sync, a new service to run, and (for SaaS) send visitor queries off our server. None of that is justified at a few hundred documents. `pg_trgm` is a trusted contrib extension shipped in the `postgres:18` image, so the migration enables it.

Query handling, in `packages/database/src/search-text.ts`:

- normalize: Unicode NFC, lower case, strip combining marks, `ё` to `е`, punctuation to spaces, collapsed whitespace, at most 100 characters. The normalized query is what reports group by. Indexed text uses the same fold (`search_fold`) before `to_tsvector`, because the Russian parser keeps a combining mark inside the lexeme.
- variants: a query with Latin letters is also tried as the same keys on the Russian layout (`ащкен` style mistakes, `ащкеы` for «форты») and as a transliteration (`kenigsberg` to «кенигсберг»). Each variant is searched; a document keeps its best score.
- every token becomes a prefix term (`форт:*`), so «замо» already finds «Замок Тапиау». Tokens are letters and digits only, so the text is safe for `to_tsquery`.
- typo fallback: `word_similarity(variant, title) >= 0.45` matches a title even when the stemmed words do not.

Score: `ts_rank_cd` on the weighted vector, plus 0.6 × title word similarity, plus a small boost for hubs (0.3), cities (0.2), routes and collections (0.1), so a query that names a section lands on the section first.

### What is indexed

A view, `search_documents`, unions every public entity. It is a view, not a table, so there is no sync job and no stale row: unpublishing a page removes it from search on the next query. Only published rows with `noindex = false` are included.

| Kind | Path | A | B | C | D |
| --- | --- | --- | --- | --- | --- |
| place | `/{slug}` | title | category, region | summary | body (first 20 000 characters) |
| route | `/marshruty/{slug}` | title | region | summary | body |
| collection | `/podborki/{slug}` | title | | summary | body |
| quest | `/kvesty/{slug}` | title | | summary | body |
| venue | `/zavedeniya/{slug}` | name | kind label, cuisine tags, region | description | address, signature dishes |
| hub | `/{category slug}` | title | | description | body |
| city | `/gde-poest-seychas/{region}` | short title and title | | description | |

A city is indexed only when it has a published venue, because that is when its page exists. When the catalog passes a few thousand documents, the view becomes a materialized table refreshed on write with a GIN index. The query code does not change.

### Search UI

- Header: a search field on desktop and a search icon on phones. It is a plain `GET` form to `/poisk`, so it works without JavaScript.
- `/poisk?q=...`: server-rendered results, `noindex, follow`, canonical `/poisk`, not in the sitemap. Bots and people get the same HTML. Each result shows a type label, title, city and one line of summary. An empty result shows the 404 link lists (hubs, popular places, routes) and says the query was noted.
- The 404 page has the same form, marked with surface `404`.
- The hidden `s` field records the surface (`header`, `page`, `404`).
- `GET /api/search?q=` returns the same results as JSON. It is a pure read and logs nothing.

### Event model

Table `search_events`, one row per event, written by `POST /api/search/events` from the browser after the results are shown:

- `search`: `search_id` (random UUID made by the page), raw `query`, `normalized`, `result_count`, `surface`. If the same session searched in the last 5 minutes, `refined_from` points at that search. That row is a refinement.
- `click`: same `search_id`, `position` (1-based), `result_path`.
- Exit without a click is not an event. It is derived in reports: a search with no click and no later refinement.

Privacy is ADR 0013: no cookie, no account id, no IP. The visitor key is the same daily HMAC, and the session key is taken from the visitor's latest page view, so a search joins `analytics_hits` and we can see how that session arrived (entry channel, landing page) and where it went. Bot User-Agents are stored with `is_bot = true` and left out of reports. Signed-in editors are not recorded. Raw rows are purged after 13 months by the same daily job.

### Reporting

The repository (`db.search`) has `report(from, to)` with totals (searches, sessions, zero-result rate, click-through, refinement rate, exits), top queries, zero-result queries, click-through by position, surfaces, and the entry channels of searching sessions. Queries are joined with `analytics_search_queries` on the normalized text, so a query that people type on our site and that Google already shows us for is visible as one row.

- MCP: `search_report` and `search_zero_results`, read-only and audited like the analytics tools.
- Admin: `/admin/search`, same figures, same period picker as `/admin/analytics`.

### Feeding content

Zero-result queries are content opportunities. `search_zero_results` returns them with counts and any GSC impressions, ready for the editor or MCP agent to turn into a page or into a synonym in a page's summary. Adding them as a signal to the 0-100 content score (ADR 0016) comes after we have a few weeks of data, because a score fed by three searches would be noise.

## Consequences

Search costs one Postgres query per request and no new service. Results reflect the catalog instantly. The event table is small and private, and it ties site search to arrivals, exits and external search demand. Later: suggestions while typing (same API), the Yandex Webmaster join when that import is configured, zero-result signals in content scoring, and a materialized index if the catalog grows.
