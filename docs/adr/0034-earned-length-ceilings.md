# ADR 0034: Earned length ceilings

## Status

Accepted. Amends ADR 0016.

## Context

ADR 0016 scores body length against a ceiling per page type (a place 6000, a route 12000, a collection 8000, a hub 8000, a quest 4000). Anything longer loses points. Some queries need a longer page: a route with many sourced stops, a hub whose FAQ is earned by impressions, a place whose competitors for that query are longer. Raising every ceiling would reward padding.

## Decision

The default ceilings stay. A page may store one length override on its passport (`page_passports.length_override`):

- `ceiling`: an integer above that page's default and at most 20000.
- `queries`: the searches the extra length should rank for.
- Evidence, one of: `search.impressions` (at least 1) and `search.position` (above 0 and at most 100), taken from `analytics_search_queries` (Yandex Webmaster or Google Search Console), or `competitors` as `{ query, chars }` for the top page on that query.
- `sections`: the extra sections that length covers.
- `setAt`: an ISO time the server writes. A resave that does not change the justification keeps it. A changed justification starts the clock again.

`page_passport_set` refuses a venue override, a ceiling that is not above the default, a ceiling above 20000, and a payload that is missing queries, evidence, or sections. `null` clears the override. Omitting the field leaves it, including a save from `/admin/content-scores`, which does not edit this field.

Scoring uses the extended ceiling only when the stored override still meets those rules, including `setAt`. Otherwise the default ceiling applies and the quality checks include `length override ignored`.

A page whose article is above its default ceiling is also checked for filler: an H2 whose body is a near-duplicate of another H2, a repeated or near-duplicate paragraph, and any hit from `writingHits` in `apps/web-app/shared/writing.ts`. One such hit costs 10 quality points. The article is the same text `lengthNorm` already measures, including a collection whose body is the module projection.

When the override has been in place for 60 days, search rows have been imported, and the page has no impressions in the same 90-day window the rest of the score uses, the results block gains `length override: no impressions after 60 days` and loses 10 points. An empty search table is not a failure, matching ADR 0016.

`content_report_weekly` adds `lengthOverrides`: path, title, type, ceiling, body length, organic entrances at 30 and 90 days, impressions, clicks, whether the override is applied, whether it is stale, and `setAt`. Stale rows come first so a page that has not earned its length can be cut back.

Competitor lengths are the editor's justification. The score does not fetch other sites. The publish review checks that each added section has its own sourced facts.

## Consequences

A short sourced page stays short. A long page has to name the demand and the sections, and it shows up in the weekly report with the traffic that demand produced. Impressions still come only from the imported search table.

## Not doing yet

Raising a default ceiling. Fetching competitor pages. A venue description past 600 characters. Editing the override on the admin passport form.
