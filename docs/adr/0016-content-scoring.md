# ADR 0016: Content scoring and page passports

## Status

Accepted.

## Context

Editors can publish places, routes, collections, quests, and hubs, and ADR 0013 stores cookieless page analytics. Nothing yet says what a page is for, or which pages are thin, unlinked, or missing their search goal. The owner should see that without reading the database.

## Decision

Each scored URL has an optional page passport and a score from 0 to 100. Scored URLs are published places (`/{slug}`), routes (`/marshruty/{slug}`), collections (`/podborki/{slug}`), hubs (`/forty`, `/zamki`, `/plyazhi`, `/kurorty`, `/muzei`, `/eda`), and quests (`/kvesty/{slug}`). Drafts, reviews, and archived rows are not scored. A draft such as the old quest `five-forts` stays in the catalog so its passport can still be edited, and the score run leaves it out of `content_scores`. Archived rows are omitted from the catalog.

The passport is one `page_passports` row per page (`page_type` + `entity_id`, with the public path stored beside it):

- `targetQueries`: the queries the page should rank for.
- `audience`: who the page is for.
- `primaryAction`: `build_route`, `buy_ticket`, `go_next_place`, `claim_offer`, or `read`. `claim_offer` is the action phase 2 offers will use. It does not create an offer.
- `goal30d` and `goal90d`: organic entrance goals.
- `notes`.

`page_passport_get` and `page_passport_set` edit it. The same form is on `/admin/content-scores`. A slug change keeps the row and rewrites `path` on the next score run.

The score is four blocks, each 0 to 100. The page total is the rounded mean. Failing checks are short English strings stored on the row (`no FAQ`, `orphan`, `description 40 chars`). The admin table shows the same text in Russian.

Quality:

- Body length is characters of the public article. A place uses the article after the repeated lead is stripped and `howToGet` is folded into `## Как добраться`. A hub uses `categories.body` (migration `0012_hub_body`). The short description stays the summary and is not the article. Norms: major place (`forty`, `zamki`) 3000–6000, minor place 2000–6000, route 8000–12000, collection 5000–8000, quest 2000–4000. A hub is an SEO landing page: the body is 2000–8000 characters, which leaves room for a FAQ. Padding a short page up to the minimum is forbidden, and so is stuffing past the ceiling.
- Article pages (place, route, collection, quest) need a directions heading, a practical block, and `## Частые вопросы` with at least six questions from `faqFromBody`. Zero questions is `no FAQ`. A place may use `howToGet` instead of a heading. Directions match a `##` or `###` heading that contains `Как добраться`, `Дорога`, `Транспорт`, `Без машины`, `Как ехать`, `Как доехать`, `Как передвигаться`, or `На машине`. The practical block is `hours` or `price` on a place, a heading about prices, tickets, budget, or opening hours (`Цены`, `Стоимость`, `Билеты`, `Бюджет`, `Сколько стоит`, `Режим работы`, and the same family), or a ruble amount in the body (`₽`, `руб.`, `рублей`), including a markdown table. A collection whose published stops all share one region does not need that directions heading: the stops are in one city, as on `gorodskie-vorota-kaliningrada` and `kaliningrad-v-dozhd`. The same check also passes when every published stop has an address or transport line, either the item note or the place `howToGet` (`ул.`, a street word, or a transport word such as `автобус` or `пешком`). Hubs stay lists for directions and prices, so those two checks are skipped. Hub FAQ uses the same six-question rule on `categories.body`. Outbound links on a hub include markdown links in that body.
- Photos: a major place needs 3, every other page needs 1. A route, collection, quest, or hub counts photos on its published member places.
- Facts: a place uses `last_verified_at`. There is no separate column. `place_update` and `place_draft_update` set it with `factsCheckedAt`, an ISO date (`YYYY-MM-DD` or a full timestamp). Date-only values are stored as UTC midnight. Omit the field to keep the current value. `null` clears it. The call may send only `id` or `slug` plus `factsCheckedAt`, and the article stays as it is. The write is an `mcp_audits` row with the tool name. Routes, collections, hubs, and quests have no such column, so their update tools do not accept the field and the score still uses `updated_at`. Missing is `facts not checked`. Older than 180 days fails.
- A passport is filled when it has a query, an audience, an action, and both goals. An empty passport is `passport empty`.

Linking follows the public templates, including the header and footer hubs and the route, collection, and quest indexes. Inbound is how many other public pages link here. A published indexable page with none is `orphan`. Outbound for the points is the page's own links, not the shared header. A place that is in no published route and no published collection fails `not in a route or collection`.

Indexing uses the same rules as the sitemap and the public loaders. In the sitemap, HTTP 200, JSON-LD types from `placeDocument` / `collectionDocument` (breadcrumb plus the page type), title 30–65 characters, description 110–160, and a canonical equal to `https://k39.online` plus the path. Drafts and reviews are not scored. A published place with no category still fails `not in sitemap` and `not 200`. `signals.yandexIndexed` and `signals.googleIndexed` stay null until a later job fills them. Null does not fail the block. `false` fails `not in Yandex` or `not in Google`.

Results read `analytics_hits` and `analytics_search_queries`. Organic entrances are entry pageviews whose channel starts with `organic`, over 7, 30, and 90 days. A set goal that the page missed is `organic 30d: 0, goal 50` (and the 90-day twin). Search queries count when the imported row names the page, or when a site-wide query equals a passport target. An empty search table is not a failure: the import has not run. Scroll depth and engaged time fail only when the page has pageviews and the beacon recorded a weak or missing value. Clicks to the next page count `[data-track]` outbound hits and a later pageview in the same session.

`content_scores` holds the latest run. `content_score_days` keeps one row per page per UTC day so `content_report_weekly` can subtract the latest day on or before seven days ago. The report returns average deltas, the five highest and lowest totals, pages under a goal, and the largest drops.

A Nitro plugin runs the score once a day, using `analytics_runs` kind `content-scores` so a restart does not repeat it. `/admin` and `content_score_get` with `refresh: true` recompute immediately. `content_scores_list` filters by type, by block, and by a threshold on that block (or on the total).

## Consequences

Scores describe the current templates and the first-party tables. They do not crawl the live site and they do not call Yandex Webmaster or Search Console. A hub that is `noindex` drops out of the sitemap; the score uses that same list.
